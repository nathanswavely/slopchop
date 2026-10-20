// Load, merge and save the ledger.
//
// The ledger is the artifact, not the tooling. It is checked in because it
// IS the transparency claim: a machine-checkable record of which words were
// drafted by a model and which were written by a person, with the drafts
// kept alongside the replacements. A paragraph asserting "the copy is human"
// is worth less than a file anyone can diff.

import fs from 'node:fs';
import path from 'node:path';
import { extractEntries, idFor, tierFor, wordCount } from './extract/index.js';
import { syntaxOf } from './expressions.js';

// unreviewed → a model drafted it and nobody has looked yet (the default)
// rewritten  → a replacement is chosen; writeback has not applied it
// human      → the text in source is a person's words
// ai-fine    → deliberately left as drafted; mechanical or not voice-bearing
// ai-revised → a model's suggested rewrite, accepted without edits, in source
// not-copy   → not text a person reads: a format string, an identifier, a
//              fixture that slipped into scope. A claim about the string,
//              not about who wrote it, so it is left out of every total
//              and listed by name in the report instead
//
// A rewritten entry whose replacement is a model suggestion taken as-is is
// marked replacement_source: 'model', and becomes ai-revised, never human,
// when it lands. `human` only ever means a person typed it.
//
// A human entry also says how, in the person's own words: authorship.kind
// is written (they rewrote it), edited (they made small edits), or claimed
// (no edits; the words were already theirs). SlopChop records what the
// person says. It does not measure or second-guess it.
export const STATUSES = ['unreviewed', 'rewritten', 'human', 'ai-fine', 'ai-revised', 'not-copy'];

/** The statuses a person can choose directly. ai-revised is only ever earned. */
export const CHOOSABLE = ['unreviewed', 'rewritten', 'human', 'ai-fine', 'not-copy'];

/** The statuses that count as decided, among the strings that are counted. */
export const DECIDED = new Set(['human', 'ai-fine', 'ai-revised']);

/**
 * Decided, and left out of the totals. Leaving text out is never a quiet
 * way to move the numbers: stats says how much, and the report lists it.
 */
export const EXCLUDED = new Set(['not-copy']);

export const EMPTY = { version: 1, strict: false, entries: [], retired: [] };

export function load(project) {
  if (!fs.existsSync(project.ledgerPath)) return structuredClone(EMPTY);
  const raw = JSON.parse(fs.readFileSync(project.ledgerPath, 'utf8'));
  return { ...structuredClone(EMPTY), ...raw };
}

export function save(project, ledger) {
  fs.mkdirSync(path.dirname(project.ledgerPath), { recursive: true });
  fs.writeFileSync(project.ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
}

/**
 * Re-extract from source and fold the result into an existing ledger,
 * preserving every human decision.
 *
 * Returns { ledger, added, removed, landed } so callers can report honestly
 * instead of silently reconciling.
 */
export function sync(project, existing = load(project)) {
  return merge(existing, extractEntries(project));
}

/** The pure half of sync: fold fresh entries into an existing ledger. */
export function merge(existing, fresh) {
  const prior = new Map(existing.entries.map((e) => [e.id, e]));
  const retired = new Map((existing.retired || []).map((e) => [e.id, e]));

  // A rewrite can reach the source without `apply`: a committed suggestion
  // on a pull request, or someone pasting it in by hand. The person's words
  // are in the ledger already, so text that matches them is theirs.
  //
  // A rewrite can also split one paragraph into several. Each piece is then
  // its own string in source, and each is as much the person's as the whole
  // was, whether the split arrived by apply or by a committed suggestion.
  const rewrites = new Map();
  for (const e of [...existing.entries, ...retired.values()]) {
    if (e.status === 'rewritten' && e.replacement) {
      rewrites.set(idFor(e.replacement), e);
      for (const piece of pieces(e.replacement)) rewrites.set(idFor(piece), e);
    } else if (WRITTEN.has(e.status)) {
      for (const piece of pieces(e.text)) if (!rewrites.has(idFor(piece))) rewrites.set(idFor(piece), e);
    }
  }

  const added = [];
  const landed = new Set();
  const entries = fresh.map((f) => {
    const seen = prior.get(f.id) || retired.get(f.id);
    const from = !seen && rewrites.get(f.id);
    if (from) {
      landed.add(from);
      return withAuthorship({
        ...f,
        status: from.status === 'rewritten' ? landedStatus(from) : from.status,
        note: from.note ?? null,
        previous_ai_text: from.previous_ai_text || from.text,
        ...(from.authorship && from.replacement_source !== 'model' ? { authorship: { kind: from.authorship.kind } } : {}),
      });
    }
    if (!seen) { added.push(f); return f; }
    return withAuthorship({
      ...f,
      status: seen.status || 'unreviewed',
      replacement: seen.replacement ?? null,
      note: seen.note ?? null,
      ...(seen.replacement_source ? { replacement_source: seen.replacement_source } : {}),
      // The draft this text replaced, kept for the public record.
      ...(seen.previous_ai_text ? { previous_ai_text: seen.previous_ai_text } : {}),
      // Advice is keyed by the text it was given about, so it stays valid
      // for as long as the id does.
      ...(seen.triage ? { triage: seen.triage } : {}),
      ...(seen.suggestion ? { suggestion: seen.suggestion } : {}),
      ...(seen.authorship ? { authorship: { kind: seen.authorship.kind } } : {}),
    });
  });

  const freshIds = new Set(fresh.map((e) => e.id));
  const removed = existing.entries.filter((e) => !freshIds.has(e.id));

  // A decision that took thought is worth keeping even after the string
  // leaves the source; an untouched `unreviewed` carries no information.
  // A rewrite that landed everywhere lives on as the new entry's
  // previous_ai_text; keeping the old entry too would count it twice.
  const landedIds = new Set([...landed].map((e) => e.id));
  const keptRetired = [...retired.values(), ...removed]
    .filter((e) => e.status && e.status !== 'unreviewed')
    .filter((e) => !freshIds.has(e.id))
    .filter((e) => !landedIds.has(e.id));
  const dedupedRetired = [...new Map(keptRetired.map((e) => [e.id, e])).values()];

  return {
    ledger: { ...existing, version: 1, entries, retired: dedupedRetired },
    added,
    removed,
    landed: [...landed],
  };
}

/** Statuses whose text in source is somebody's deliberate writing. */
const WRITTEN = new Set(['human', 'ai-revised']);

/** The paragraphs of a text, if a blank line splits it into more than one. */
function pieces(text) {
  const parts = text.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [];
}

export function stats(ledger) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  // Words per status, not just counts. A progress bar wants human plus
  // ai-fine; a provenance claim wants them apart. Both are kept.
  const wordsByStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byTier = { label: { done: 0, total: 0 }, helper: { done: 0, total: 0 }, prose: { done: 0, total: 0 } };
  // Human, split by how: the badge counts written and claimed as a
  // person's words; edited is reported on its own line.
  const byAuthorship = { written: 0, edited: 0, claimed: 0 };
  const wordsByAuthorship = { written: 0, edited: 0, claimed: 0 };
  let words = 0;
  let wordsDone = 0;
  // Counted on their own line, never in the totals above them.
  const excluded = { total: 0, words: 0 };

  for (const e of ledger.entries) {
    if (EXCLUDED.has(e.status)) {
      byStatus[e.status]++;
      wordsByStatus[e.status] += e.words;
      excluded.total++;
      excluded.words += e.words;
      continue;
    }
    if (e.status === 'human') {
      const kind = authorshipOf(e).kind;
      byAuthorship[kind]++;
      wordsByAuthorship[kind] += e.words;
    }
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    wordsByStatus[e.status] = (wordsByStatus[e.status] || 0) + e.words;
    const done = DECIDED.has(e.status);
    byTier[e.tier].total++;
    if (done) byTier[e.tier].done++;
    words += e.words;
    if (done) wordsDone += e.words;
  }

  const total = ledger.entries.length - excluded.total;
  const done = [...DECIDED].reduce((n, st) => n + byStatus[st], 0);
  return {
    total, done, pending: total - done, byStatus, wordsByStatus,
    byAuthorship, wordsByAuthorship, byTier, words, wordsDone, excluded,
  };
}

/**
 * Apply one review decision to an entry, in place. Returns the entry.
 * `kind` is what the person says they did with a replacement: 'written'
 * (a rewrite) or 'edited' (small edits). Left out, it is 'written'.
 */
export function decide(entry, { status, replacement, note, kind }) {
  if (status && !CHOOSABLE.includes(status)) throw new Error(`bad status: ${status}`);
  if (kind != null && !DECLARABLE.includes(kind)) throw new Error(`bad kind: ${kind}`);
  if (status) entry.status = status;
  if (replacement !== undefined) setReplacement(entry, replacement, { kind });
  if (note !== undefined) entry.note = note || null;
  if (entry.status === 'rewritten' && !entry.replacement) entry.status = 'unreviewed';

  // Pressing "already mine" on text nobody replaced is a claim. On text a
  // person already replaced and applied, what they said then stands.
  if (entry.status === 'human' && !entry.replacement) {
    if (!entry.previous_ai_text) entry.authorship = { kind: 'claimed' };
    else withAuthorship(entry);
  } else if (entry.status !== 'rewritten') {
    delete entry.authorship;
  }
  return entry;
}

/** What a person can say they did with a replacement. */
export const DECLARABLE = ['written', 'edited'];

/**
 * Record a replacement and what the person says they did. The one thing
 * worked out here rather than taken on their word is whether it is a
 * model's suggestion verbatim, which is a fact about the text, not a
 * judgment of it: that lands as ai-revised.
 */
export function setReplacement(entry, text, { kind } = {}) {
  entry.replacement = text || null;
  if (entry.replacement && entry.suggestion?.text === entry.replacement) {
    entry.replacement_source = 'model';
    delete entry.authorship;
    return entry;
  }
  delete entry.replacement_source;
  if (!entry.replacement) { delete entry.authorship; return entry; }
  entry.authorship = { kind: kind || 'written' };
  return entry;
}

/**
 * How a human entry came to be. An entry from before people said so is
 * read from what the ledger already knows: one that replaced a draft was a
 * rewrite, since that is all "human" meant then; one that did not was
 * theirs to begin with.
 */
export function authorshipOf(entry) {
  if (entry.authorship) return entry.authorship;
  return { kind: entry.previous_ai_text ? 'written' : 'claimed' };
}

/** Fill in authorship on a human entry that has none. In place. */
function withAuthorship(entry) {
  if (entry.status === 'human' && !entry.authorship) entry.authorship = authorshipOf(entry);
  if (entry.status !== 'human' && entry.status !== 'rewritten') delete entry.authorship;
  return entry;
}

/** What a landed replacement becomes: the person's, unless a model wrote it. */
function landedStatus(entry) {
  return entry.replacement_source === 'model' ? 'ai-revised' : 'human';
}

/**
 * Fold an applied replacement back into the entry: the new text becomes the
 * entry's identity, and the model's draft is preserved as the record of what
 * was replaced.
 */
export function promote(entry, newText) {
  const previous = entry.previous_ai_text || entry.text;
  entry.previous_ai_text = previous;
  entry.text = newText;
  entry.id = idFor(newText);
  entry.words = wordCount(newText, syntaxOf(entry.occurrences));
  entry.tier = tierFor(newText, syntaxOf(entry.occurrences));
  entry.status = landedStatus(entry);
  entry.replacement = null;
  if (entry.status !== 'human') delete entry.authorship;
  delete entry.replacement_source;
  delete entry.suggestion;
  delete entry.triage;
  return entry;
}

/**
 * The ratchet. Given the ledger on disk and a fresh sync of it, which
 * strings entered the source with no decision recorded and are not part of
 * the debt accepted at baseline?
 */
export function gate(onDisk, fresh) {
  const baseline = new Set(onDisk.baseline || []);
  const unreviewed = fresh.entries.filter((e) => e.status === 'unreviewed');
  return {
    unledgered: unreviewed.filter((e) => !baseline.has(e.id)),
    backlog: unreviewed.filter((e) => baseline.has(e.id)),
    pendingApply: fresh.entries.filter((e) => e.status === 'rewritten'),
    // A status this tool does not define is not a decision, whoever wrote
    // it into the file. It fails the check rather than passing for one.
    unknown: fresh.entries.filter((e) => !STATUSES.includes(e.status)),
    strict: !!onDisk.strict,
  };
}
