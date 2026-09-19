// JSON message catalogs: every string value, with its key path for context.
//
// A catalog is copy that somebody already extracted, so the whole file is
// in scope and the filter is only there to drop the obviously non-copy
// (URLs, identifiers, colours). Keys are never copy.

import { pushHit, isCatalogCopy, collapse } from './common.js';

/** Every string value in a JSON document, with position and key path. */
export function scanJson(src) {
  const out = [];
  const stack = [];
  const pathOf = () => stack.map((f) => (f.type === 'arr' ? `[${f.index}]` : f.key)).join('.').replace(/\.\[/g, '[');

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      const start = i + 1;
      let j = start;
      while (j < src.length && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      const raw = src.slice(start, j);
      const top = stack[stack.length - 1];
      if (top && top.type === 'obj' && top.expectKey) {
        top.key = decode(raw);
        top.expectKey = false;
      } else {
        out.push({ raw, index: start, at: pathOf(), text: decode(raw) });
      }
      i = j + 1;
      continue;
    }
    if (c === '{') stack.push({ type: 'obj', key: null, expectKey: true });
    else if (c === '[') stack.push({ type: 'arr', index: 0 });
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',') {
      const top = stack[stack.length - 1];
      if (top?.type === 'obj') top.expectKey = true;
      else if (top?.type === 'arr') top.index++;
    }
    i++;
  }
  return out;
}

function decode(raw) {
  try { return JSON.parse(`"${raw}"`); }
  catch { return raw; }
}

export function extractJson(file, src) {
  const hits = [];
  for (const s of scanJson(src)) {
    if (!isCatalogCopy(s.text)) continue;
    pushHit(hits, { file, raw: s.raw, index: s.index, src, kind: 'json-value', quote: '"', text: collapse(s.text), at: s.at });
  }
  return hits;
}
