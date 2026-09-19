// Markdown and MDX: prose a paragraph at a time, plus frontmatter values
// and the text inside any raw HTML or JSX blocks.

import { blank, blocks, pushHit } from './common.js';
import { scanYaml, yamlHits } from './yaml.js';
import { htmlRegion } from './html.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// An import/export statement and the lines that continue it, up to the next
// blank line. MDX only.
const MDX_STATEMENT = /^(?:import|export)\b[^\n]*(?:\n(?!\s*$)[^\n]*)*/gm;

export function extractMd(file, src, ctx, { mdx = false } = {}) {
  const hits = [];
  let clean = blank(src, /<!--[\s\S]*?-->/g);

  const fm = clean.match(FRONTMATTER);
  if (fm) {
    const bodyOffset = fm.index + fm[0].indexOf(fm[1]);
    hits.push(...yamlHits(file, src, scanYaml(fm[1], bodyOffset)));
    clean = blank(clean, FRONTMATTER);
  }

  if (mdx) clean = blank(clean, MDX_STATEMENT);

  for (const b of blocks(clean)) {
    if (!/[A-Za-z]{3}/.test(b.text)) continue;
    // Badge rows, link-reference lines and bare images are chrome, not copy.
    if (/^\s*[!\[]/.test(b.text) && b.text.length < 200) continue;
    // Raw HTML or a JSX component: the words between its tags are the copy.
    if (b.text.startsWith('<')) {
      hits.push(...htmlRegion(file, b.text, src, b.offset));
      continue;
    }
    if (mdx && b.text.startsWith('{')) continue;   // an expression
    pushHit(hits, { file, raw: b.text, index: b.offset, src, kind: 'md-block' });
  }
  return hits;
}

export function extractMdx(file, src, ctx) {
  return extractMd(file, src, ctx, { mdx: true });
}
