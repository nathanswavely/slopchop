// YAML message catalogs and Markdown frontmatter, with no YAML library.
//
// This is a deliberate subset: block mappings and sequences, plain and
// quoted scalars, and `|` / `>` block scalars. Flow collections, anchors,
// aliases and tags are skipped rather than guessed at. That covers the shape
// of every locale file the tool has met; anything stranger is left alone,
// which is the failure mode the tool prefers (a string not offered) over the
// alternative (a string rewritten in the wrong place).

import { pushHit, isCatalogCopy, collapse } from './common.js';

const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#[\]{}&*!|>%@`-][^:#]*?|-[^\s:#][^:#]*?)\s*:(?=\s|$)/;

/** Strip a trailing ` # comment` that is outside quotes. */
function stripComment(value) {
  let q = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (q) {
      if (q === '"' && c === '\\') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).replace(/\s+$/, '');
  }
  return value.replace(/\s+$/, '');
}

function unquoteKey(k) {
  if (k[0] === '"') { try { return JSON.parse(k); } catch { return k.slice(1, -1); } }
  if (k[0] === "'") return k.slice(1, -1).replace(/''/g, "'");
  return k.trim();
}

const indentOf = (l) => l.match(/^ */)[0].length;
const isItem = (r) => r === '-' || r.startsWith('- ');

/**
 * Scalars in a YAML document. `offset` is where `src` begins in the file it
 * was cut from (frontmatter), so indices point at the real file.
 * Returns [{raw, index, text, kind, quote, at, indent}].
 */
export function scanYaml(src, offset = 0) {
  const out = [];
  const lines = src.split('\n').map((l) => l.replace(/\r$/, ''));
  const starts = [];
  let pos = 0;
  for (const l of src.split('\n')) { starts.push(pos); pos += l.length + 1; }

  // Key path for context only. [{indent, key}], innermost last.
  const stack = [];
  const pathWith = (key) => [...stack.map((f) => f.key), key].filter(Boolean).join('.').replace(/\.\[/g, '[');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line) || /^(---|\.\.\.)(\s|$)/.test(line) || /^%/.test(line)) continue;

    const indent = indentOf(line);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();

    let rest = line.slice(indent);
    let valueCol = indent;
    let seq = false;
    if (isItem(rest)) {
      seq = true;
      rest = rest.slice(2);
      valueCol += 2;
      // The item is a frame of its own, so a mapping inside it nests under
      // `steps[]` rather than beside it.
      stack.push({ indent, key: '[]' });
      if (!rest.trim()) continue;
    }

    const km = rest.match(KEY);
    let value;
    let at;
    if (km) {
      const key = unquoteKey(km[1]);
      at = pathWith(key);
      value = rest.slice(km[0].length);
      valueCol += km[0].length;
      // Children of this key sit deeper than the key itself.
      stack.push({ indent: seq ? indent + 2 : indent, key });
    } else if (seq) {
      at = pathWith('');
      value = rest;
    } else {
      continue;   // a continuation line; its scalar consumed it below
    }

    const lead = value.match(/^\s*/)[0].length;
    value = value.slice(lead);
    valueCol += lead;
    if (!value) continue;

    // Block scalar: the more-indented lines that follow.
    if (/^[|>]([+-]?\d?[+-]?)\s*(#.*)?$/.test(value)) {
      let j = i + 1;
      const body = [];
      while (j < lines.length) {
        if (!lines[j].trim()) { body.push(j); j++; continue; }
        if (indentOf(lines[j]) <= indent) break;
        body.push(j); j++;
      }
      while (body.length && !lines[body[body.length - 1]].trim()) body.pop();
      i = j - 1;
      if (!body.length) continue;
      const bindent = ' '.repeat(indentOf(lines[body[0]]));
      const rawStart = starts[body[0]] + bindent.length;
      const lastLine = body[body.length - 1];
      const rawEnd = starts[lastLine] + lines[lastLine].length;
      const raw = src.slice(rawStart, rawEnd).replace(/\r/g, '');
      const text = body.map((n) => lines[n].slice(bindent.length)).join('\n').replace(/\s+$/, '');
      out.push({ raw, index: offset + rawStart, text, kind: 'yaml-block', quote: null, at, indent: bindent });
      continue;
    }

    value = stripComment(value);
    if (!value) continue;
    const first = value[0];
    if ('[{&*!'.includes(first)) continue;   // flow collection, anchor, alias, tag

    if (first === '"' || first === "'") {
      let j = 1;
      if (first === '"') {
        while (j < value.length && value[j] !== '"') { if (value[j] === '\\') j++; j++; }
      } else {
        while (j < value.length) {
          if (value[j] === "'") { if (value[j + 1] === "'") { j += 2; continue; } break; }
          j++;
        }
      }
      if (j >= value.length) continue;   // runs onto the next line; skipped
      const inner = value.slice(1, j);
      const text = first === '"' ? unquoteKey(`"${inner}"`) : inner.replace(/''/g, "'");
      out.push({ raw: inner, index: offset + starts[i] + valueCol + 1, text, kind: 'yaml-quoted', quote: first, at });
      continue;
    }

    // Plain scalar, possibly continued on more-indented lines. The whole
    // run is one raw so writeback replaces all of it, never just line one.
    let end = starts[i] + valueCol + value.length;
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j];
      if (!l.trim()) break;
      const li = indentOf(l);
      if (li <= indent) break;
      const r = l.slice(li);
      if (KEY.test(r) || isItem(r)) break;
      end = starts[j] + l.length;
      j++;
    }
    const raw = src.slice(starts[i] + valueCol, end).replace(/\r/g, '');
    out.push({ raw, index: offset + starts[i] + valueCol, text: collapse(raw), kind: 'yaml-plain', quote: null, at });
    i = j - 1;
  }
  return out;
}

export function yamlHits(file, src, scalars) {
  const hits = [];
  for (const s of scalars) {
    if (!isCatalogCopy(s.text)) continue;
    pushHit(hits, {
      file, raw: s.raw, index: s.index, src, kind: s.kind, quote: s.quote,
      text: s.kind === 'yaml-block' ? s.text : collapse(s.text), at: s.at, indent: s.indent,
    });
  }
  return hits;
}

export function extractYaml(file, src) {
  return yamlHits(file, src, scanYaml(src));
}
