// JavaScript and TypeScript: sentence-shaped string literals. JSX/TSX adds
// the text between tags and the copy-bearing attributes on them.

import { blank, pushHit, isProseLiteral, isMarkupNoise, collapse, decodedText, attrHits, splitOnDirectives, verbatim } from './common.js';

/** Strip line and block comments so commentary never enters the ledger. */
export function stripComments(code) {
  return blank(blank(code, /\/\*[\s\S]*?\*\//g), /(^|[^:'"`])\/\/[^\n]*/g);
}

export function extractJsStrings(file, code, fullSrc, offset = 0, kind = 'js-string') {
  const hits = [];
  const clean = stripComments(code);
  const re = /(['"`])((?:[^\\\n]|\\.)*?)\1/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const val = m[2];
    if (!isProseLiteral(val)) continue;
    pushHit(hits, {
      file, raw: val, index: offset + m.index + 1, src: fullSrc, kind, quote: m[1],
    });
  }
  return hits;
}

export function extractJs(file, src) {
  return extractJsStrings(file, src, src, 0);
}

// -------------------------------------------------------------------- JSX ---

// Text that directly follows a tag. Plain `>` and `<` are comparison
// operators everywhere else in a JS file, so a text node only counts when
// the thing before it parses as an opening or closing tag.
// The closing `<` is a lookahead: it belongs to the next tag, which has to
// stay available as the *opening* tag of the next match.
const AFTER_TAG = /(<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*?)?\/?>)([^<]+)(?=<)/g;

/**
 * Text nodes that follow a real tag, in markup that may hold JSX-style
 * expressions. `markup` is the same length as `src` with anything that is
 * not markup already blanked. Shared with Astro templates.
 */
export function afterTagText(file, markup, src, { kind = 'jsx-text', text = (s) => collapse(s) } = {}) {
  const hits = [];
  for (const m of markup.matchAll(AFTER_TAG)) {
    const chunk = m[2];
    const chunkIndex = m.index + m[1].length;
    if (!collapse(chunk)) continue;
    for (const seg of splitOnDirectives(chunk)) {
      const raw = seg.text;
      if (!collapse(raw) || isMarkupNoise(raw)) continue;
      const lead = raw.match(/^\s*/)[0].length;
      const trail = raw.match(/\s*$/)[0].length;
      const inner = raw.slice(lead, raw.length - trail);
      if (!inner) continue;
      const index = chunkIndex + seg.offset + lead;
      pushHit(hits, { file, raw: verbatim(src, index, inner), index, src, kind, text: text(inner) });
    }
  }
  return hits;
}

export function extractJsx(file, src) {
  const clean = stripComments(src);
  // JSX decodes `&amp;` in text and in attribute strings, as HTML does.
  const hits = afterTagText(file, clean, src, { text: decodedText });

  hits.push(...attrHits(file, clean, src, 0, 'jsx-attr', undefined, { text: decodedText }));

  // Remaining string literals, marked as JSX so writeback refuses rather
  // than backslash-escapes a quote: a JSX attribute value has no escapes.
  const claimed = new Set(hits.map((h) => `${h.line}:${h.raw}`));
  for (const h of extractJsStrings(file, src, src, 0, 'jsx-string')) {
    if (claimed.has(`${h.line}:${h.raw}`)) continue;
    hits.push(h);
  }
  return hits;
}
