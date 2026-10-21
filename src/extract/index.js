// The extractor registry, and the fold from raw hits into ledger entries.
//
// Identical text in twelve files collapses to ONE entry with twelve
// occurrences. You decide "Save changes" once.

import fs from 'node:fs';
import path from 'node:path';
import { tierFor, wordCount, decodedText } from './common.js';
import { idFor } from './id.js';
import { syntaxOf } from '../expressions.js';
import { extractSvelte, svelteMarkup } from './svelte.js';
import { extractAstro, astroTemplate } from './astro.js';
import { extractJs, extractJsx, stripComments } from './js.js';
import { renderedKeys, keyedStrings, componentProps } from './rendered.js';
import { extractGo, extractGoErrors } from './go.js';
import { extractMd, extractMdx } from './md.js';
import { extractHtml, extractVue } from './html.js';
import { extractJson } from './json.js';
import { extractYaml } from './yaml.js';

export { collapse, tierFor, wordCount, BLOCK_KINDS } from './common.js';
export { idFor } from './id.js';

// JS and JSX also give short strings for the keys a template shows, and
// JSX components their copy props (rendered.js). That half lives here, not
// in js.js, which the bookmarklet bundles and has no use for it.
const keyed = (file, src, ctx) => keyedStrings(file, src, src, 0, ctx.renderedKeys, 'js-string', ctx.ignoreKeys);

export const EXTRACTORS = {
  svelte: extractSvelte,
  astro: extractAstro,
  js: (file, src, ctx = {}) => [...extractJs(file, src), ...keyed(file, src, ctx)],
  jsx: (file, src, ctx = {}) => {
    const clean = stripComments(src);
    // A sentence-shaped prop is a string literal too; it is recorded once,
    // as the prop it is.
    const props = componentProps(file, clean, src, 'jsx-attr', { text: decodedText });
    const claimed = new Set(props.map((h) => `${h.line}:${h.raw}`));
    return [
      ...extractJsx(file, src).filter((h) => !claimed.has(`${h.line}:${h.raw}`)),
      ...props,
      ...keyedStrings(file, src, src, 0, ctx.renderedKeys || renderedKeys(clean), 'jsx-string', ctx.ignoreKeys),
    ];
  },
  vue: extractVue,
  go: extractGo,
  'go-errors': extractGoErrors,
  md: extractMd,
  mdx: extractMdx,
  html: extractHtml,
  json: extractJson,
  yaml: extractYaml,
};

/**
 * Hits from one source, without touching disk. `ctx` carries project policy
 * the extractors need (currently only the frozen-constant set).
 */
export function extractOne(file, lang, src, ctx = {}) {
  const fn = EXTRACTORS[lang];
  if (!fn) throw new Error(`no extractor for language "${lang}"`);
  return fn(file, src, ctx);
}

// Where a template shows its keys, for each language that has one.
const MARKUP = {
  astro: astroTemplate,
  svelte: svelteMarkup,
  jsx: stripComments,
};

/**
 * The keys any in-scope template renders where a person reads them, pooled:
 * the list of services is in one file, the page that shows it in another.
 */
export function projectKeys(sources) {
  const keys = new Set();
  for (const { lang, src } of sources) if (MARKUP[lang]) renderedKeys(MARKUP[lang](src), keys);
  return keys;
}

/** Every hit across every in-scope file, unmerged. */
export function extractAll(project) {
  const sources = project.sourceFiles().map(({ file, lang }) => (
    { file, lang, src: fs.readFileSync(path.join(project.root, file), 'utf8') }));
  const ctx = { frozen: project.frozen, ignoreKeys: project.ignoreKeys, renderedKeys: projectKeys(sources) };
  return sources.flatMap(({ file, lang, src }) => extractOne(file, lang, src, ctx));
}

/** Hits folded into ledger entries, keyed by the hash of the collapsed text. */
export function extractEntries(project) {
  return foldHits(extractAll(project));
}

export function foldHits(hits) {
  const byId = new Map();
  for (const h of hits) {
    const id = idFor(h.text);
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        text: h.text,
        words: 0,
        tier: 'label',
        status: 'unreviewed',
        replacement: null,
        note: null,
        occurrences: [],
      });
    }
    const e = byId.get(id);
    if (!e.occurrences.some((o) => o.file === h.file && o.line === h.line)) {
      const occ = { file: h.file, line: h.line, kind: h.kind, raw: h.raw, quote: h.quote };
      if (h.at) occ.at = h.at;
      if (h.indent !== undefined) occ.indent = h.indent;
      e.occurrences.push(occ);
    }
  }
  for (const e of byId.values()) {
    e.occurrences.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    // Counted once every occurrence is in: whether `{x}` is an expression or
    // two literal braces depends on where the text lives.
    const syntax = syntaxOf(e.occurrences);
    e.words = wordCount(e.text, syntax);
    e.tier = tierFor(e.text, syntax);
  }
  return [...byId.values()].sort(
    (a, b) => a.occurrences[0].file.localeCompare(b.occurrences[0].file)
           || a.occurrences[0].line - b.occurrences[0].line);
}
