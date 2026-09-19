// Go: raw-string documents split into paragraphs, interpreted strings that
// read as sentences, and the messages inside `{"error":"..."}` bodies.

import { blank, pushHit, isData, isProseLiteral, blocks, collapse } from './common.js';

function stripComments(src) {
  return blank(blank(src, /\/\*[\s\S]*?\*\//g), /(^|[^:])\/\/[^\n]*/g);
}

/**
 * Is the raw string starting at `index` assigned to a frozen constant?
 * Looks back for the `const NAME = ` that introduces it. Frozen constants
 * are hash-matched records the program compares bytes against; editing one
 * character breaks whatever depends on the match, so they never enter the
 * queue at all.
 */
function isFrozen(src, index, frozen) {
  if (!frozen || !frozen.size) return false;
  const before = src.slice(Math.max(0, index - 200), index);
  const decl = before.match(/(?:const|var)\s+(\w+)\s*(?:=|string\s*=)\s*$/);
  return !!decl && frozen.has(decl[1]);
}

/**
 * API error bodies: `{"error":"..."}` handed to http.Error. Only the
 * message is captured, never the JSON around it, so writeback replaces the
 * words and leaves the wrapper intact.
 */
export function extractGoErrors(file, src) {
  const hits = [];
  const clean = stripComments(src);
  const errRe = /`\{"error":"((?:[^"\\`])*)"\}`/g;
  let m;
  while ((m = errRe.exec(clean)) !== null) {
    const val = m[1];
    if (!/[A-Za-z]{3}/.test(val) || !/\s/.test(val)) continue;
    pushHit(hits, {
      file, raw: val, index: m.index + '`{"error":"'.length, src, kind: 'go-error-body',
    });
  }
  return hits;
}

export function extractGo(file, src, { frozen } = {}) {
  const hits = [];
  const clean = stripComments(src);

  // Raw (backtick) strings hold the long-form documents. Split them into
  // paragraph blocks so review happens a paragraph at a time.
  const rawRe = /`([^`]*)`/g;
  let m;
  while ((m = rawRe.exec(clean)) !== null) {
    const body = m[1];
    if (!/[A-Za-z]{3}/.test(body)) continue;
    if (isFrozen(clean, m.index, frozen)) continue;
    const base = m.index + 1;
    if (isData(body)) continue;
    if (body.length > 200) {
      for (const b of blocks(body)) {
        if (!/[A-Za-z]{3}/.test(b.text) || isData(b.text)) continue;
        pushHit(hits, { file, raw: b.text, index: base + b.offset, src, kind: 'go-doc-block' });
      }
    } else if (/\s/.test(collapse(body))) {
      pushHit(hits, { file, raw: body, index: base, src, kind: 'go-raw-string' });
    }
  }

  hits.push(...extractGoErrors(file, src));

  // Interpreted strings: struct fields, notification titles, email subjects.
  const strRe = /"((?:[^"\\\n]|\\.)*)"/g;
  const withoutRaw = blank(clean, /`[^`]*`/g);
  while ((m = strRe.exec(withoutRaw)) !== null) {
    const val = m[1];
    if (!isProseLiteral(val)) continue;
    pushHit(hits, { file, raw: val, index: m.index + 1, src, kind: 'go-string', quote: '"' });
  }

  return hits;
}
