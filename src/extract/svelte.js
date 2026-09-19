// Svelte components: markup text nodes, copy-bearing attributes, and the
// sentence-shaped strings inside <script> (toasts, error messages, labels).

import { blank, textNodes, attrHits } from './common.js';
import { extractJsStrings } from './js.js';

export function extractSvelte(file, src) {
  // Script and style are handled separately / not at all; comments never.
  const markup = blank(
    blank(blank(src, /<script[\s\S]*?<\/script>/g), /<style[\s\S]*?<\/style>/g),
    /<!--[\s\S]*?-->/g);

  const hits = [
    ...textNodes(file, markup, src, 0, 'markup'),
    ...attrHits(file, markup, src, 0, 'attr'),
  ];

  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRe.exec(src)) !== null) {
    const offset = m.index + m[0].indexOf(m[1]);
    hits.push(...extractJsStrings(file, m[1], src, offset));
  }
  return hits;
}
