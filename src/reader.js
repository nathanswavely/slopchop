// The Reader: check a live page against a copy disclosure.
//
// It finds the page's strings with the same HTML extractor `sync` uses, so a
// string on a page is the string the ledger recorded: text between tags,
// copy-bearing attributes, <meta> descriptions, with entities decoded. Each
// one is hashed with the `slop: 1` ID and looked up. Found, it is declared
// copy, shown with the status the declarant gave it. Not found, it is
// undeclared copy, listed by its text. The file never says where a string
// appears; the page does.
//
// It reads declarations and checks nothing. A status is what the declarant
// says, and an out-of-scope reason is their explanation, shown beside the
// undeclared copy it may explain, never counted as covering it.
//
// Template strings in source (`about {event.name}`) never match the
// rendered text, and read as undeclared.
//
// No Node imports: the CLI and the bookmarklet run this same file.

import { htmlRegion } from './extract/html.js';
import { SLOP_VERSION, slopId, slopText, parseStatus } from './slop.js';

const NOT_COPY = 'not-copy';

/** What kind of place a hit came from, in a word or two. */
function whereOf(hit) {
  if (hit.kind === 'html-text') return 'text';
  if (hit.at) return hit.at;                    // "meta description"
  return hit.kind.replace(/^html-attr:/, '');   // alt, title, placeholder…
}

/** Page markup from a string, a Document, or an Element. */
function markupOf(page) {
  if (typeof page === 'string') return page;
  if (page?.documentElement) return page.documentElement.outerHTML;
  if (typeof page?.outerHTML === 'string') return page.outerHTML;
  throw new TypeError('a Reader takes page HTML, a Document, or an Element');
}

/**
 * The strings on a page, once each, roughly in page order (by line):
 * [{ text, where: ['text', 'alt', …], count }].
 */
export function pageStrings(page) {
  const html = markupOf(page);
  const byText = new Map();
  // The extractor finds text, then attributes, then <meta>; sorted by line
  // they read the way the page does.
  const hits = htmlRegion('page', html, html, 0).sort((a, b) => a.line - b.line);
  for (const hit of hits) {
    const text = slopText(hit.text);
    if (!text) continue;
    let s = byText.get(text);
    if (!s) byText.set(text, (s = { text, where: [], count: 0 }));
    s.count++;
    const where = whereOf(hit);
    if (!s.where.includes(where)) s.where.push(where);
  }
  return [...byText.values()];
}

/** Throws unless `d` is a copy disclosure this Reader can read. */
export function checkDisclosure(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('not a copy disclosure: expected a JSON object');
  if (d.slop !== SLOP_VERSION) {
    throw new Error(`unsupported copy disclosure version ${JSON.stringify(d.slop)}; this Reader reads slop: ${SLOP_VERSION}`);
  }
  if (!d.copy || typeof d.copy !== 'object' || Array.isArray(d.copy)) throw new Error('not a copy disclosure: "copy" must map IDs to statuses');
  return d;
}

/**
 * Read one page against a disclosure. Returns
 *
 *   { declarant, contact, generated, statement, outOfScope,
 *     declared:   [{ id, text, status, base, replaced, where, count }],
 *     undeclared: [{ id, text, where, count }],
 *     counts: { total, declared, undeclared, notCopy, byStatus } }
 *
 * `total` is the page's denominator: declared plus undeclared, leaving out
 * strings declared not-copy. `declared` excludes them too; they stay in the
 * declared list, with their status, so the call can be seen.
 */
export async function readPage(page, disclosure) {
  const d = checkDisclosure(disclosure);
  const strings = pageStrings(page);
  const ids = await Promise.all(strings.map((s) => slopId(s.text)));

  const declared = [], undeclared = [];
  const byStatus = {};
  strings.forEach((s, i) => {
    const id = ids[i];
    if (!Object.hasOwn(d.copy, id)) { undeclared.push({ id, ...s }); return; }
    const status = String(d.copy[id]);
    const { status: base, replaced } = parseStatus(status);
    declared.push({ id, text: s.text, status, base, replaced, where: s.where, count: s.count });
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  const notCopy = declared.filter((x) => x.base === NOT_COPY).length;
  return {
    slop: d.slop,
    declarant: typeof d.declarant === 'string' ? d.declarant : '',
    contact: typeof d.contact === 'string' ? d.contact : '',
    generated: typeof d.generated === 'string' ? d.generated : '',
    statement: typeof d.statement === 'string' ? d.statement : '',
    outOfScope: Array.isArray(d.outOfScope) ? d.outOfScope.filter((r) => typeof r === 'string' && r.trim()) : [],
    declared,
    undeclared,
    counts: {
      total: declared.length - notCopy + undeclared.length,
      declared: declared.length - notCopy,
      undeclared: undeclared.length,
      notCopy,
      byStatus,
    },
  };
}

/**
 * Who a disclosure is declared by: its declarant, or, when it names none,
 * whoever owns the domain that serves it.
 */
export function declaredBy(declarant, pageUrl) {
  if (declarant) return declarant;
  let host = '';
  try { host = new URL(pageUrl).host; } catch { /* a local file has no domain */ }
  return host ? `the owner of ${host}` : "the owner of the site's domain";
}

/** Where a page's disclosure lives: /slop.json at the page's origin. */
export function disclosureUrl(pageUrl) {
  return new URL('/slop.json', pageUrl).href;
}

// What each status says, in the ledger's own terms. Neutral on purpose:
// a Reader repeats a declaration, it does not grade one.
const LABELS = {
  human: 'written by a person',
  'ai-revised': "a model's rewrite of a draft, accepted unedited",
  'ai-fine': 'left as a model drafted it',
  'not-copy': 'not copy, not counted',
};

/** The order statuses are listed in, most a person's first. */
export const STATUS_ORDER = ['human+', 'human', 'ai-revised+', 'ai-revised', 'ai-fine', 'not-copy'];

/** [status, n] pairs in STATUS_ORDER, anything unrecognized last. */
export function byStatusOrder(counts) {
  const rank = (s) => (STATUS_ORDER.includes(s) ? STATUS_ORDER.indexOf(s) : STATUS_ORDER.length);
  return Object.entries(counts).sort(([a], [b]) => rank(a) - rank(b));
}

/** A status as words: "human+" → "written by a person, replacing a draft". */
export function describeStatus(status) {
  const { status: base, replaced } = parseStatus(status);
  const label = LABELS[base];
  if (!label) return status;
  return replaced && base === 'human' ? `${label}, replacing a draft` : label;
}
