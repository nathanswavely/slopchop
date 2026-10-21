// The copy disclosure: a public, self-reported slop.json for a site whose
// source is closed (docs/adr/0001-copy-disclosure-is-hash-only-slop-json.md).
//
// It carries a plain statement that it is self-reported, a declarant and
// a contact if the owner names them (unnamed, the declarant is whoever owns
// the site's domain), the out-of-scope reasons, and a map of ID to status. No
// text and no locations: a Reader hashes the live page and looks the IDs
// up. What it leaves out (unreviewed strings, rewrites not yet applied) a
// Reader shows as undeclared, so a stale or partial file understates.
//
// Opt-in, through a `disclosure` block in .slopchop.json that `init` never
// writes. `report` writes the file; switching the block off makes `report`
// delete it rather than leave the last one deployed.

import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { SLOP_VERSION, STATEMENT, slopId, formatStatus } from './slop.js';
import { describeStatus } from './reader.js';

export const DEFAULT_PATH = 'public/slop.json';
export const FILE_NAME = 'slop.json';

/** The statuses a disclosure lists. Everything else is left out. */
export const PUBLISHED = ['human', 'ai-revised', 'ai-fine', 'not-copy'];

/** Statuses whose `+` means a person or a model replaced a draft. */
const REPLACING = new Set(['human', 'ai-revised']);

/**
 * The `disclosure` block, resolved, or null when there is none. `block`
 * defaults to the one the project was loaded with; the review server passes
 * the one on disk, which can have changed since.
 */
export function disclosureOf(project, block = project.config.disclosure) {
  if (block == null) return null;
  if (typeof block !== 'object' || Array.isArray(block)) {
    throw new Error(`${project.rel(project.configPath)}: "disclosure" must be an object`);
  }
  const rel = typeof block.path === 'string' && block.path.trim() ? block.path.trim() : DEFAULT_PATH;
  return {
    enabled: block.enabled === true,
    path: rel,
    abs: path.resolve(project.root, rel),
    declarant: typeof block.declarant === 'string' ? block.declarant.trim() : '',
    contact: typeof block.contact === 'string' ? block.contact.trim() : '',
  };
}

/**
 * What is wrong with a disclosure block, as sentences, or []. A path has to
 * stay inside the project and name a slop.json: `report` deletes the file
 * at that path when the block is switched off, and a Reader only ever looks
 * for /slop.json.
 */
export function problemsOf(project, d) {
  const out = [];
  const rel = path.relative(project.root, d.abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) out.push(`path must be inside the project (got "${d.path}")`);
  else if (path.basename(d.abs) !== FILE_NAME) out.push(`path must name a file called ${FILE_NAME} (got "${d.path}")`);
  return out;
}

/**
 * Sort the ledger into what a disclosure lists and what it leaves out.
 * A `rewritten` entry is a pending rewrite: the page still shows the old
 * text, so it is left out until `apply` lands it.
 */
export function classify(ledger) {
  const publish = [];
  let unreviewed = 0, pending = 0, other = 0;
  for (const e of ledger.entries) {
    if (e.status === 'unreviewed') unreviewed++;
    else if (e.status === 'rewritten') pending++;
    else if (PUBLISHED.includes(e.status)) {
      publish.push({ entry: e, status: formatStatus(e.status, REPLACING.has(e.status) && !!e.previous_ai_text) });
    } else other++;
  }
  return { publish, unreviewed, pending, other };
}

/** The reasons from `outOfScope`, without their paths. */
export function outOfScopeReasons(project) {
  const reasons = (project.outOfScope || [])
    .map((o) => (typeof o?.reason === 'string' ? o.reason.trim() : ''))
    .filter(Boolean);
  return [...new Set(reasons)];
}

/** The slop.json object. IDs sorted, so a regenerated file diffs cleanly. */
export async function buildDisclosure(project, ledger, { now = new Date(), block } = {}) {
  const d = disclosureOf(project, block);
  const { publish } = classify(ledger);
  const pairs = await Promise.all(publish.map(async (p) => [await slopId(p.entry.text), p.status]));
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  // Declarant and contact are optional, and left out rather than written
  // empty: unnamed, the declarant is whoever owns the site's domain.
  return {
    slop: SLOP_VERSION,
    ...(d?.declarant ? { declarant: d.declarant } : {}),
    ...(d?.contact ? { contact: d.contact } : {}),
    generated: localDate(now),
    statement: STATEMENT,
    outOfScope: outOfScopeReasons(project),
    copy: Object.fromEntries(pairs),
  };
}

/** YYYY-MM-DD, in the declarant's own time zone: the day they ran report. */
function localDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Does this file hold a copy disclosure? Only then will `report` delete it. */
function isDisclosureFile(abs) {
  try {
    const v = JSON.parse(fs.readFileSync(abs, 'utf8'));
    return v && typeof v === 'object' && 'slop' in v && 'copy' in v;
  } catch { return false; }
}

/**
 * Write, delete or leave the file, as the block says. Returns what happened,
 * or null when there is no block:
 *   { action: 'wrote', path, count, byStatus }
 *   { action: 'removed', path }       switched off; the file was there
 *   { action: 'off', path }           switched off; nothing to remove
 * Throws on a block it cannot act on, before touching anything.
 */
export async function writeDisclosure(project, ledger, opts = {}) {
  const d = disclosureOf(project);
  if (!d) return null;
  const problems = problemsOf(project, d);
  if (problems.length) {
    throw new Error(`${project.rel(project.configPath)}: disclosure: ${problems.join('; ')}`);
  }

  if (!d.enabled) {
    if (!fs.existsSync(d.abs)) return { action: 'off', path: d.path };
    if (!isDisclosureFile(d.abs)) {
      throw new Error(`disclosure is off, but ${d.path} does not look like a copy disclosure; left it alone`);
    }
    fs.unlinkSync(d.abs);
    return { action: 'removed', path: d.path };
  }

  const file = await buildDisclosure(project, ledger, opts);
  fs.mkdirSync(path.dirname(d.abs), { recursive: true });
  fs.writeFileSync(d.abs, JSON.stringify(file, null, 2) + '\n');
  const byStatus = {};
  for (const st of Object.values(file.copy)) byStatus[st] = (byStatus[st] || 0) + 1;
  return { action: 'wrote', path: d.path, count: Object.keys(file.copy).length, byStatus };
}

/**
 * What the review page shows before anything is published: the strings
 * that would be listed, by status, with their text (local only, never in
 * the file); how many are left out and why; and the reasons that become
 * public.
 */
export async function previewDisclosure(project, ledger, block = project.config.disclosure) {
  const d = disclosureOf(project, block);
  const { publish, unreviewed, pending } = classify(ledger);
  const byStatus = {};
  for (const p of publish) {
    (byStatus[p.status] ||= []).push({ id: await slopId(p.entry.text), text: p.entry.text });
  }
  return {
    block: block ?? null,
    disclosure: d && { enabled: d.enabled, path: d.path, declarant: d.declarant, contact: d.contact },
    problems: d ? problemsOf(project, d) : [],
    count: publish.length,
    byStatus,
    left: { unreviewed, pending },
    labels: Object.fromEntries(Object.keys(byStatus).map((s) => [s, describeStatus(s)])),
    outOfScope: outOfScopeReasons(project),
    statement: STATEMENT,
  };
}

// ----------------------------------------------------- the config block ---

/**
 * The `disclosure` block as it stands in the config file on disk: null when
 * there is none, undefined when there is no file.
 */
export function readBlock(configPath) {
  if (!fs.existsSync(configPath)) return undefined;
  return JSON.parse(fs.readFileSync(configPath, 'utf8')).disclosure ?? null;
}

/**
 * Rewrite only the `disclosure` value of a config file's text, or add it at
 * the end. Every other byte stays as it was: the review page's toggle has
 * no business reformatting someone's config.
 */
export function setBlock(text, block) {
  const { open, keys } = topLevelKeys(text);
  if (text[open] !== '{') throw new Error('config is not a JSON object');
  const first = keys[0];
  const indent = first ? text.slice(text.lastIndexOf('\n', first.keyStart) + 1, first.keyStart) : '  ';
  const unit = /^\s+$/.test(indent) ? indent : '  ';
  const rendered = JSON.stringify(block, null, unit).split('\n').join(`\n${unit}`);

  const at = keys.find((k) => k.key === 'disclosure');
  let out;
  if (at) {
    out = text.slice(0, at.valueStart) + rendered + text.slice(at.valueEnd);
  } else if (keys.length) {
    const last = keys[keys.length - 1];
    out = `${text.slice(0, last.valueEnd)},\n${unit}"disclosure": ${rendered}${text.slice(last.valueEnd)}`;
  } else {
    out = `${text.slice(0, open + 1)}\n${unit}"disclosure": ${rendered}\n${text.slice(open + 1).replace(/^\s*/, '')}`;
  }

  // The edit is textual, so check it said what was meant.
  const want = { ...JSON.parse(text), disclosure: block };
  if (!isDeepStrictEqual(JSON.parse(out), want)) {
    throw new Error('could not edit the disclosure block in place');
  }
  return out;
}

/** Write a disclosure block into the config file. Nothing else changes. */
export function writeBlock(configPath, block) {
  const text = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(configPath, setBlock(text, block));
}

/**
 * Where each top-level key's value starts and ends in a JSON object's text.
 * A scanner rather than a parser: it only needs to skip strings and count
 * brackets.
 */
function topLevelKeys(text) {
  const keys = [];
  let depth = 0, open = -1, pending = null;
  const ws = (j) => /\s/.test(text[j] || '');
  const finish = (i) => {
    let e = i;
    while (e > pending.valueStart && ws(e - 1)) e--;
    keys.push({ ...pending, valueEnd: e });
    pending = null;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      if (depth === 1 && !pending) {
        let j = end + 1;
        while (ws(j)) j++;
        if (text[j] === ':') {
          let v = j + 1;
          while (ws(v)) v++;
          pending = { key: JSON.parse(text.slice(i, end + 1)), keyStart: i, valueStart: v };
          i = v - 1;
          continue;
        }
      }
      i = end;
    } else if (c === '{' || c === '[') {
      if (++depth === 1) open = i;
    } else if (c === '}' || c === ']') {
      if (depth === 1 && pending) finish(i);
      if (--depth === 0) break;
    } else if (c === ',' && depth === 1 && pending) {
      finish(i);
    }
  }
  return { open, keys };
}
