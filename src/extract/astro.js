// Astro components: a TypeScript frontmatter fence, then a template that is
// HTML with JSX-style `{expressions}`, plus optional <script> and <style>.
//
// The template goes through the JSX text-node matcher rather than the
// Svelte one, because Astro templates are full of arrow functions inside
// `{items.map((item) => (...))}` and the looser `>text<` scan reads every
// `=>` as the end of a tag.

import { blank, attrHits, collapse, decodeEntities } from './common.js';
import { extractJsStrings, afterTagText } from './js.js';

// The fence has to open the file. A `---` further down is a horizontal rule
// someone typed, not frontmatter.
const FENCE = /^(\s*---[ \t]*\r?\n)([\s\S]*?)\r?\n---[ \t]*(?=\r?\n|$)/;
const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

// What is left between two tags inside `{cond ? (<a/>) : (<b/>)}`: the
// ternary's punctuation and the next condition, not a sentence.
const EXPRESSION_RESIDUE = /^\)\s*[:?]|\?\s*\($|&&\s*\($|\?\./;
// An arrow or a times sign written as an entity, with nothing else to read.
const ENTITY_ONLY = /^(?:&[a-z]+;|&#\d+;|[^A-Za-z0-9])+$/i;

export function extractAstro(file, src) {
  const hits = [];
  let template = src;

  const fence = src.match(FENCE);
  if (fence) {
    hits.push(...extractJsStrings(file, fence[2], src, fence[1].length));
    template = blank(template, FENCE);
  }

  // Client scripts: their strings can be copy (an alert, a toast), the
  // same as a Svelte <script>. Collected before the block is blanked.
  for (const m of template.matchAll(SCRIPT)) {
    const offset = m.index + m[0].indexOf(m[1]);
    hits.push(...extractJsStrings(file, m[1], src, offset));
  }

  template = blank(template, SCRIPT);
  template = blank(template, /<style\b[\s\S]*?<\/style>/g);
  template = blank(template, /<!--[\s\S]*?-->/g);
  template = blank(template, /\{\/\*[\s\S]*?\*\/\}/g);

  // Astro templates are HTML, so `&amp;` is common; show it decoded.
  hits.push(...afterTagText(file, template, src, { text: (s) => decodeEntities(collapse(s)) })
    .filter((h) => !EXPRESSION_RESIDUE.test(h.text) && !ENTITY_ONLY.test(h.text)));
  hits.push(...attrHits(file, template, src, 0, 'jsx-attr'));

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
