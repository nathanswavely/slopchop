// A rewrite, small edits, or already theirs: what the person says they did.

import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, merge, stats, promote, authorshipOf } from '../src/ledger.js';
import { renderReport, badge } from '../src/report.js';
import { idFor } from '../src/extract/index.js';

const DRAFT = 'We are passionate about building tools that empower small teams to do their best work.';

const entry = (text, over = {}) => ({
  id: idFor(text), text, words: text.split(' ').length, tier: 'prose', status: 'unreviewed',
  replacement: null, note: null, occurrences: [{ file: 'a.md', line: 1, kind: 'md-block', raw: text }], ...over,
});

test('the person says whether it was a rewrite or small edits, and that is what is kept', () => {
  const e = entry(DRAFT);
  // Nearly every word changed, but they called it small edits: it stays small edits.
  decide(e, { status: 'rewritten', replacement: 'I make small tools for teams of two or three.', kind: 'edited' });
  assert.deepEqual(e.authorship, { kind: 'edited' });

  // One word changed, called a rewrite: it stays a rewrite.
  decide(e, { status: 'rewritten', replacement: DRAFT.replace('passionate', 'serious'), kind: 'written' });
  assert.deepEqual(e.authorship, { kind: 'written' });

  // Said nothing (a draft pulled back in, the CLI): a rewrite.
  decide(e, { status: 'rewritten', replacement: 'Another go at it.' });
  assert.deepEqual(e.authorship, { kind: 'written' });

  assert.throws(() => decide(e, { status: 'rewritten', replacement: 'x', kind: 'claimed' }), /bad kind/);
});

test('already mine is a claim; leaving it as drafted carries no authorship', () => {
  const e = entry(DRAFT);
  decide(e, { status: 'human', replacement: null });
  assert.deepEqual(e.authorship, { kind: 'claimed' });
  decide(e, { status: 'ai-fine', replacement: null });
  assert.equal(e.authorship, undefined);
});

test('a suggestion taken verbatim is ai-revised whatever button saved it', () => {
  const e = entry(DRAFT, { suggestion: { text: 'I build tools for small teams.' } });
  decide(e, { status: 'rewritten', replacement: 'I build tools for small teams.', kind: 'written' });
  assert.equal(e.replacement_source, 'model');
  assert.equal(e.authorship, undefined);
  promote(e, e.replacement);
  assert.equal(e.status, 'ai-revised');
});

test('what was said survives apply and sync; older entries read from what the ledger knows', () => {
  const e = entry(DRAFT);
  decide(e, { status: 'rewritten', replacement: DRAFT.replace('passionate about', 'into'), kind: 'edited' });
  promote(e, e.replacement);
  assert.equal(e.status, 'human');
  const { ledger } = merge({ version: 1, retired: [], entries: [e] }, [entry(e.text)]);
  assert.deepEqual(ledger.entries[0].authorship, { kind: 'edited' });

  const old = [
    entry('I make small tools for teams.', { status: 'human', previous_ai_text: DRAFT }),
    entry('Already mine from the start.', { status: 'human' }),
    // A ledger written while a measurement briefly existed: only the kind is kept.
    entry('Measured once, briefly.', { status: 'human', previous_ai_text: DRAFT, authorship: { kind: 'edited', changed: 0.1, from: 'draft' } }),
  ];
  const back = merge({ version: 1, retired: [], entries: old }, old.map((o) => entry(o.text))).ledger;
  assert.deepEqual(back.entries.map((x) => x.authorship), [{ kind: 'written' }, { kind: 'claimed' }, { kind: 'edited' }]);
  assert.equal(authorshipOf(old[1]).kind, 'claimed');
});

test('the report and badge count small edits apart from a person\'s words', () => {
  const ledger = { entries: [
    entry('I wrote this whole thing.', { status: 'human', authorship: { kind: 'written' } }),
    entry('Mine from the start, these.', { status: 'human', authorship: { kind: 'claimed' } }),
    entry('Mostly the model with a tweak.', { status: 'human', authorship: { kind: 'edited' } }),
    entry('Left as the model wrote it.', { status: 'ai-fine' }),
  ] };
  const s = stats(ledger);
  assert.deepEqual(s.byAuthorship, { written: 1, edited: 1, claimed: 1 });
  assert.equal(s.done, 4);
  assert.equal(badge(ledger).message, '100% reviewed · 50% human');

  const project = { rel: (p) => p, ledgerPath: 'copy/ledger.json', config: { include: ['a.md'] }, outOfScope: [], frozen: new Set() };
  const md = renderReport(project, ledger);
  assert.match(md, /\| Written by a person \| 1 \|/);
  assert.match(md, /\| A person's words from the start \| 1 \|/);
  assert.match(md, /\| Drafted by a model, edited by a person \| 1 \|/);
  assert.match(md, /does not check it/);
});
