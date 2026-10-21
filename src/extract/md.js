// Markdown and MDX: prose a paragraph at a time, headings a line at a time,
// plus frontmatter values and the text inside any raw HTML or JSX blocks.

import { blank, blocks, collapse, pushHit } from './common.js';
import { scanYaml, yamlHits } from './yaml.js';
import { htmlRegion } from './html.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// An import/export statement and the lines that continue it, up to the next
// blank line. MDX only.
const MDX_STATEMENT = /^(?:import|export)\b[^\n]*(?:\n(?!\s*$)[^\n]*)*/gm;

// An ATX heading: up to three spaces, one to six #, then the words, then an
// optional closing run of # after a space. Group 2 is the words.
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))??(?:[ \t]+#+)?[ \t\r]*$/d;

// A setext underline, which makes the paragraph lines above it a heading.
const SETEXT = /^ {0,3}(=+|-+)[ \t\r]*$/;

// Lines a setext underline cannot turn into a heading: under a list item or
// a blockquote, `---` is a thematic break.
const NOT_SETEXT = /^ {0,3}([-*+]|\d+[.)]|>)(\s|$)/;

/**
 * Split one blank-line-separated block into what a page renders apart:
 * headings, each on its own, and the paragraph runs between them.
 *
 * A heading's `raw` is its words alone, without the `#` marks or a setext
 * underline. Those words are what a page shows in the <h2>, so they are
 * what is hashed. And `raw` is also what writeback replaces, so a rewrite
 * lands between the marks and the marks stay.
 *
 * Returns [{ heading, raw, offset }], `offset` counted from the start of
 * `text`.
 */
export function splitBlock(text) {
  const out = [];
  let para = null;            // { start, end, first } within text
  const flushPara = () => {
    if (para) {
      const raw = text.slice(para.start, para.end).replace(/\s+$/, '');
      const lead = raw.length - raw.replace(/^\s+/, '').length;
      if (raw.trim()) out.push({ heading: false, raw: raw.slice(lead), offset: para.start + lead });
    }
    para = null;
  };

  let pos = 0;
  for (const line of text.split('\n')) {
    const start = pos;
    const end = pos + line.length;
    pos = end + 1;

    const atx = ATX.exec(line);
    if (atx) {
      flushPara();
      if (atx[2]) out.push({ heading: true, raw: atx[2], offset: start + atx.indices[2][0] });
      continue;
    }
    if (para && SETEXT.test(line) && !NOT_SETEXT.test(para.first)) {
      const raw = text.slice(para.start, para.end).replace(/\s+$/, '');
      const lead = raw.length - raw.replace(/^\s+/, '').length;
      out.push({ heading: true, raw: raw.slice(lead), offset: para.start + lead });
      para = null;
      continue;
    }
    if (!para) para = { start, end, first: line };
    else para.end = end;
  }
  flushPara();
  return out;
}

/** A heading's text as a page shows it: the words, without the marks. */
export function headingText(raw) {
  return collapse(raw);
}

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
    // Raw HTML or a JSX component: the words between its tags are the copy.
    if (b.text.startsWith('<')) {
      if (/[A-Za-z]{3}/.test(b.text)) hits.push(...htmlRegion(file, b.text, src, b.offset));
      continue;
    }
    for (const seg of splitBlock(b.text)) {
      if (!/[A-Za-z]{3}/.test(seg.raw)) continue;
      const index = b.offset + seg.offset;
      if (seg.heading) {
        pushHit(hits, { file, raw: seg.raw, index, src, kind: 'md-heading', text: headingText(seg.raw) });
        continue;
      }
      // Badge rows, link-reference lines and bare images are chrome, not copy.
      if (/^\s*[!\[]/.test(seg.raw) && seg.raw.length < 200) continue;
      if (mdx && seg.raw.startsWith('{')) continue;   // an expression
      pushHit(hits, { file, raw: seg.raw, index, src, kind: 'md-block' });
    }
  }
  return hits;
}

export function extractMdx(file, src, ctx) {
  return extractMd(file, src, ctx, { mdx: true });
}
