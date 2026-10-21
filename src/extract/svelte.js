// Svelte components: markup text nodes, copy-bearing attributes, and the
// sentence-shaped strings inside <script> (toasts, error messages, labels).

import { blank, textNodes, attrHits, decodedText } from './common.js';
import { extractJsStrings } from './js.js';
import { renderedKeys, keyedStrings, componentProps } from './rendered.js';

/** The markup alone: script, style and comments blanked. */
export function svelteMarkup(src) {
  return blank(
    blank(blank(src, /<script[\s\S]*?<\/script>/g), /<style[\s\S]*?<\/style>/g),
    /<!--[\s\S]*?-->/g);
}

export function extractSvelte(file, src, ctx = {}) {
  // Script and style are handled separately / not at all; comments never.
  const markup = svelteMarkup(src);

  // Svelte decodes `&amp;` in markup and attributes, as HTML does.
  const hits = [
    ...textNodes(file, markup, src, 0, 'markup', { text: decodedText }),
    ...attrHits(file, markup, src, 0, 'attr', undefined, { text: decodedText }),
    ...componentProps(file, markup, src, 'attr', { text: decodedText }),
  ];

  // Short strings for the keys the markup shows (rendered.js).
  const keys = ctx.renderedKeys || renderedKeys(markup);
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRe.exec(src)) !== null) {
    const offset = m.index + m[0].indexOf(m[1]);
    hits.push(...extractJsStrings(file, m[1], src, offset));
    hits.push(...keyedStrings(file, m[1], src, offset, keys, 'js-string', ctx.ignoreKeys));
  }
  return hits;
}
