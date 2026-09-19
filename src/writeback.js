// Apply approved replacements back into source.
//
// The contract is exact-match-or-refuse. Every occurrence records the
// verbatim source substring it came from; writeback finds that substring or
// reports drift and changes nothing. It never fuzzy-matches, never guesses
// at an offset, and never half-applies an entry. If one of an entry's nine
// occurrences has drifted, none of the nine are touched, because a string
// that reads differently in nine places is worse than one nobody rewrote yet.

import fs from 'node:fs';
import path from 'node:path';
import { promote } from './ledger.js';
import { encodeEntities } from './extract/common.js';

/** Byte offset of the start of 1-indexed `line`. */
function offsetOfLine(content, line) {
  let off = 0;
  for (let i = 1; i < line; i++) {
    const nl = content.indexOf('\n', off);
    if (nl === -1) return off;
    off = nl + 1;
  }
  return off;
}

// A YAML plain scalar that would be read as something else once written.
const YAML_NEEDS_QUOTES = /^[\s[\]{}&*!|>'"%@`#,?:-]|: | #|:$|^(true|false|null|yes|no|on|off|~)$|^[-+.]?\d/i;

/**
 * Render `text` so it survives the syntax it is being dropped into.
 * Returns { value } or { problem }. A problem blocks the whole entry.
 * `occ` is the full occurrence, for kinds that need more than the quote.
 */
export function encodeFor(kind, quote, text, occ = {}) {
  if (kind === 'markup') {
    // Svelte reads { and } as expression delimiters in markup.
    if (/[{}]/.test(text)) {
      return { problem: 'contains { or }, which Svelte markup reads as an expression. Use &#123; / &#125;' };
    }
    if (/</.test(text)) return { problem: 'contains <, which would open a tag' };
    return { value: text };
  }

  if (kind.startsWith('attr:') || kind.startsWith('jsx-attr:')) {
    const q = quote || '"';
    if (text.includes(q)) return { problem: `contains the ${q} that closes the attribute` };
    if (/[{}<]/.test(text)) return { problem: 'contains { } or <, which are unsafe in an attribute value' };
    if (/\n/.test(text)) return { problem: 'attribute values must stay on one line' };
    return { value: text };
  }

  if (kind === 'jsx-text') {
    if (/[{}<>]/.test(text)) return { problem: 'contains { } < or >, which JSX text cannot hold. Use an expression or an entity' };
    return { value: text };
  }

  if (kind === 'js-string' || kind === 'go-string') {
    const q = quote || (kind === 'go-string' ? '"' : "'");
    if (/\n/.test(text)) return { problem: 'a single-line string literal cannot hold a newline' };
    const escaped = text.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`);
    return { value: escaped };
  }

  // A string in a JSX file may be an attribute value, which has no escapes,
  // so a quote is refused rather than backslashed.
  if (kind === 'jsx-string') {
    const q = quote || '"';
    if (text.includes(q)) return { problem: `contains the ${q} that closes the string. Reword it or use the other quote` };
    if (text.includes('\\')) return { problem: 'contains a backslash, which a JSX attribute cannot escape' };
    if (/\n/.test(text)) return { problem: 'a single-line string cannot hold a newline' };
    return { value: text };
  }

  // A message inside `{"error":"..."}`. It sits in a Go raw string, so a
  // backtick is impossible, and inside JSON, so a quote must be escaped.
  if (kind === 'go-error-body') {
    if (text.includes('`')) return { problem: 'a Go raw string cannot contain a backtick' };
    if (text.includes('\\')) return { problem: 'an API error message cannot contain a backslash' };
    return { value: text.replace(/"/g, '\\"') };
  }

  if (kind === 'go-raw-string' || kind === 'go-doc-block') {
    if (text.includes('`')) return { problem: 'a Go raw string cannot contain a backtick' };
    return { value: text };
  }

  if (kind === 'md-block') return { value: text };

  if (kind === 'html-text') return { value: encodeEntities(text) };

  if (kind.startsWith('html-attr:')) {
    if (/\n/.test(text)) return { problem: 'attribute values must stay on one line' };
    const q = quote || '"';
    const value = encodeEntities(text).replace(new RegExp(q, 'g'), q === '"' ? '&quot;' : '&#39;');
    return { value };
  }

  if (kind === 'json-value') return { value: JSON.stringify(text).slice(1, -1) };

  if (kind === 'yaml-quoted') {
    if (/\n/.test(text)) return { problem: 'a quoted YAML scalar on one line cannot hold a newline' };
    if (quote === "'") return { value: text.replace(/'/g, "''") };
    return { value: JSON.stringify(text).slice(1, -1) };
  }

  if (kind === 'yaml-plain') {
    if (/\n/.test(text) || YAML_NEEDS_QUOTES.test(text)) return { value: JSON.stringify(text) };
    return { value: text };
  }

  if (kind === 'yaml-block') {
    const indent = occ.indent ?? '';
    return { value: text.split('\n').join(`\n${indent}`) };
  }

  return { problem: `unknown occurrence kind: ${kind}` };
}

/**
 * Resolve every pending occurrence to an absolute range in its file.
 * Returns { plan: Map<file, edits[]>, blocked: [{entry, reason}] }.
 */
function planEdits(project, ledger) {
  const pending = ledger.entries.filter(
    (e) => e.status === 'rewritten' && e.replacement && e.replacement.trim());

  const plan = new Map();     // file -> [{start, end, value}]
  const blocked = [];
  const ready = [];

  const contents = new Map();
  const readFile = (rel) => {
    if (!contents.has(rel)) {
      contents.set(rel, fs.readFileSync(path.join(project.root, rel), 'utf8'));
    }
    return contents.get(rel);
  };

  for (const entry of pending) {
    const edits = [];
    let reason = null;

    // Occurrences in file order, so the search cursor only moves forward and
    // two hits on adjacent lines can't resolve to the same range.
    const byFile = new Map();
    for (const occ of entry.occurrences) {
      if (!byFile.has(occ.file)) byFile.set(occ.file, []);
      byFile.get(occ.file).push(occ);
    }

    for (const [file, occs] of byFile) {
      let content;
      try { content = readFile(file); }
      catch { reason = `cannot read ${file}`; break; }

      occs.sort((a, b) => a.line - b.line);
      let cursor = 0;
      for (const occ of occs) {
        const enc = encodeFor(occ.kind, occ.quote, entry.replacement, occ);
        if (enc.problem) { reason = enc.problem; break; }

        const from = Math.max(cursor, Math.max(0, offsetOfLine(content, occ.line) - 240));
        let at = content.indexOf(occ.raw, from);
        if (at === -1) at = content.indexOf(occ.raw, cursor);  // file shifted
        if (at === -1) {
          reason = `source drifted: no exact match for this text in ${file} (re-run sync)`;
          break;
        }
        edits.push({ file, start: at, end: at + occ.raw.length, value: enc.value });
        cursor = at + occ.raw.length;
      }
      if (reason) break;
    }

    if (reason) { blocked.push({ entry, reason }); continue; }
    for (const e of edits) {
      if (!plan.has(e.file)) plan.set(e.file, []);
      plan.get(e.file).push(e);
    }
    ready.push(entry);
  }

  return { plan, blocked, ready, contents };
}

/**
 * @param {object} project
 * @param {object} ledger  mutated in place when apply is true
 * @param {boolean} apply  false = dry run, nothing written
 */
export function writeback(project, ledger, { apply = false } = {}) {
  const { plan, blocked, ready, contents } = planEdits(project, ledger);

  const touched = [];
  for (const [file, edits] of plan) {
    // Splice from the end so earlier offsets stay valid.
    edits.sort((a, b) => b.start - a.start);
    let content = contents.get(file);
    for (const e of edits) {
      content = content.slice(0, e.start) + e.value + content.slice(e.end);
    }
    if (apply) fs.writeFileSync(path.join(project.root, file), content);
    touched.push({ file, edits: edits.length });
  }

  if (apply) {
    for (const entry of ready) promote(entry, entry.replacement);
  }

  return {
    applied: apply,
    entries: ready.length,
    files: touched.sort((a, b) => a.file.localeCompare(b.file)),
    occurrences: touched.reduce((n, t) => n + t.edits, 0),
    blocked,
  };
}
