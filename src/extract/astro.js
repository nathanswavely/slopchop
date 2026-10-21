// Astro components: a TypeScript frontmatter fence, then a template that is
// HTML with JSX-style `{expressions}`, plus optional <script> and <style>.
//
// The template goes through the JSX text-node matcher rather than the
// Svelte one, because Astro templates are full of arrow functions inside
// `{items.map((item) => (...))}` and the looser `>text<` scan reads every
// `=>` as the end of a tag.

import { blank, attrHits, decodedText } from './common.js';
import { extractJsStrings, afterTagText } from './js.js';
import { renderedKeys, keyedStrings, componentProps } from './rendered.js';

// The fence has to open the file. A `---` further down is a horizontal rule
// someone typed, not frontmatter.
const FENCE = /^(\s*---[ \t]*\r?\n)([\s\S]*?)\r?\n---[ \t]*(?=\r?\n|$)/;
const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

// What is left between two tags inside `{cond ? (<a/>) : (<b/>)}`: the
// ternary's punctuation and the next condition, not a sentence.
const EXPRESSION_RESIDUE = /^\)\s*[:?]|\?\s*\($|&&\s*\($|\?\./;
// An arrow or a times sign written as an entity, with nothing else to read.
const ENTITY_ONLY = /^(?:&[a-z]+;|&#\d+;|[^A-Za-z0-9])+$/i;

/** The template alone: frontmatter, scripts, styles and comments blanked. */
export function astroTemplate(src) {
  let template = blank(src, FENCE);
  template = blank(template, SCRIPT);
  template = blank(template, /<style\b[\s\S]*?<\/style>/g);
  template = blank(template, /<!--[\s\S]*?-->/g);
  return blank(template, /\{\/\*[\s\S]*?\*\/\}/g);
}

export function extractAstro(file, src, ctx = {}) {
  const hits = [];
  const template = astroTemplate(src);
  // Short strings for the keys a template shows (rendered.js): this file's
  // own, unless sync pooled every template's.
  const keys = ctx.renderedKeys || renderedKeys(template);
  const code = (body, offset) => [
    ...extractJsStrings(file, body, src, offset),
    ...keyedStrings(file, body, src, offset, keys, 'js-string', ctx.ignoreKeys),
  ];

  const fence = src.match(FENCE);
  if (fence) hits.push(...code(fence[2], fence[1].length));

  // Client scripts: their strings can be copy (an alert, a toast), the
  // same as a Svelte <script>.
  for (const m of blank(src, FENCE).matchAll(SCRIPT)) {
    hits.push(...code(m[1], m.index + m[0].indexOf(m[1])));
  }

  // Astro templates are HTML, so `&amp;` is common. A page shows it decoded,
  // in text and in attributes alike, and so does the ledger.
  hits.push(...afterTagText(file, template, src, { text: decodedText })
    .filter((h) => !EXPRESSION_RESIDUE.test(h.text) && !ENTITY_ONLY.test(h.text)));
  hits.push(...attrHits(file, template, src, 0, 'jsx-attr', undefined, { text: decodedText }));
  hits.push(...componentProps(file, template, src, 'jsx-attr', { text: decodedText }));

  // String literals inside `{…}`, e.g. `{upcoming ? 'Upcoming shows' : 'Past shows'}`.
  // Only inside expressions: the apostrophes in plain template text would
  // otherwise pair up into nonsense "strings".
  const claimed = new Set(hits.map((h) => `${h.line}:${h.raw}`));
  for (const { code, offset } of expressions(template)) {
    for (const h of extractJsStrings(file, code, src, offset)) {
      if (claimed.has(`${h.line}:${h.raw}`)) continue;
      claimed.add(`${h.line}:${h.raw}`);
      hits.push(h);
    }
  }
  return hits;
}

/**
 * Top-level `{…}` spans in a template, by brace depth alone. Strings are not
 * skipped, because JSX text nested inside an expression carries apostrophes
 * that would open a "string" and never close it. A brace inside a string
 * literal in a template expression is rare enough to accept.
 */
function expressions(template) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    if (c === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0) out.push({ code: template.slice(start, i), offset: start });
    }
  }
  return out;
}
