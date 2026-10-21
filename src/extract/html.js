// HTML pages and templates, and the <template> half of Vue components.
//
// Text nodes and copy-bearing attributes, plus the <meta> descriptions a
// search result shows before anyone reaches the page. Templating syntax
// ({{ x }}, {% if %}, <% %>) is treated the way Svelte expressions are:
// interpolation stays inside the copy, control flow splits it.

import { blank, textNodes, attrHits, pushHit, decodedText, COPY_ATTRS } from './common.js';
import { extractJsStrings } from './js.js';

// <meta name="…"> / <meta property="…"> whose content a person reads: in a
// search result, or on a card when the page is shared. Not keywords, which
// nothing shows anyone.
const META_NAMES = new Set([
  'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description',
]);

/** Hits inside `region`, which starts at `offset` within `src`. */
export function htmlRegion(file, region, src, offset) {
  // <pre> is blanked as a block; inline <code> is left in place, so the
  // sentence around it splits into fragments at the tag rather than the
  // fragments being welded across text that is no longer there.
  const markup = blank(blank(blank(blank(
    region,
    /<script[\s\S]*?<\/script>/gi),
    /<style[\s\S]*?<\/style>/gi),
    /<!--[\s\S]*?-->/g),
    /<pre\b[\s\S]*?<\/pre>/gi);

  const hits = [
    ...textNodes(file, markup, src, offset, 'html-text', { text: decodedText }),
    ...attrHits(file, markup, src, offset, 'html-attr', COPY_ATTRS, { text: decodedText }),
  ];

  const metaRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(markup)) !== null) {
    const tag = m[0];
    const name = tag.match(/\b(?:name|property)\s*=\s*(["'])([^"']*)\1/i);
    if (!name || !META_NAMES.has(name[2].toLowerCase())) continue;
    // A description runs to the quote that opened it, apostrophes and all.
    const content = tag.match(/\bcontent\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/i);
    if (!content || !/[A-Za-z]{2}/.test(content[2])) continue;
    const valIndex = m.index + content.index + content[0].indexOf(content[1]) + 1;
    pushHit(hits, {
      file, raw: content[2], index: offset + valIndex, src, kind: 'html-attr:content', quote: content[1],
      text: decodedText(content[2]), at: `meta ${name[2]}`,
    });
  }
  return hits;
}

export function extractHtml(file, src) {
  return htmlRegion(file, src, src, 0);
}

export function extractVue(file, src) {
  const hits = [];
  const t = src.match(/<template[^>]*>([\s\S]*)<\/template>/);
  if (t) hits.push(...htmlRegion(file, t[1], src, t.index + t[0].indexOf(t[1])));

  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = scriptRe.exec(src)) !== null) {
    hits.push(...extractJsStrings(file, m[1], src, m.index + m[0].indexOf(m[1])));
  }
  return hits;
}
