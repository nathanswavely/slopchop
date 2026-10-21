// The extractor registry, and the fold from raw hits into ledger entries.
//
// Identical text in twelve files collapses to ONE entry with twelve
// occurrences. You decide "Save changes" once.

import fs from 'node:fs';
import path from 'node:path';
import { tierFor, wordCount } from './common.js';
import { idFor } from './id.js';
import { syntaxOf } from '../expressions.js';
import { extractSvelte } from './svelte.js';
import { extractAstro } from './astro.js';
import { extractJs, extractJsx } from './js.js';
import { extractGo, extractGoErrors } from './go.js';
import { extractMd, extractMdx } from './md.js';
import { extractHtml, extractVue } from './html.js';
import { extractJson } from './json.js';
import { extractYaml } from './yaml.js';

export { collapse, tierFor, wordCount, BLOCK_KINDS } from './common.js';
export { idFor } from './id.js';

export const EXTRACTORS = {
  svelte: extractSvelte,
  astro: extractAstro,
  js: extractJs,
  jsx: extractJsx,
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

/** Every hit across every in-scope file, unmerged. */
export function extractAll(project) {
  const hits = [];
  const ctx = { frozen: project.frozen, ignoreKeys: project.ignoreKeys };
  for (const { file, lang } of project.sourceFiles()) {
    const src = fs.readFileSync(path.join(project.root, file), 'utf8');
    hits.push(...extractOne(file, lang, src, ctx));
  }
  return hits;
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
