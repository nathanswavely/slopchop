// The ledger's merge and the CI ratchet.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { merge, gate, promote, stats, sync, load, save } from '../src/ledger.js';
import { extractEntries, idFor } from '../src/extract/index.js';
import { withProject } from './helpers.js';

const mk = (text, over = {}) => ({
  id: idFor(text), text, words: text.split(' ').length, tier: 'helper', status: 'unreviewed',
  replacement: null, note: null, occurrences: [{ file: 'a.md', line: 1, kind: 'md-block', raw: text }], ...over,
});

test('merge keeps every decision and retires decided strings that leave the source', () => {
  const existing = {
    version: 1, retired: [],
    entries: [
      mk('Kept and decided as human words.', { status: 'human', note: 'mine' }),
      mk('Gone from source but decided.', { status: 'ai-fine' }),
      mk('Gone from source and never looked at.'),
    ],
  };
  const fresh = [mk('Kept and decided as human words.'), mk('Brand new string nobody has seen.')];
  const { ledger, added, removed } = merge(existing, fresh);
  assert.equal(ledger.entries[0].status, 'human');
  assert.equal(ledger.entries[0].note, 'mine');
  assert.deepEqual(added.map((e) => e.text), ['Brand new string nobody has seen.']);
  assert.equal(removed.length, 2);
  assert.deepEqual(ledger.retired.map((e) => e.text), ['Gone from source but decided.']);
});

test('a retired decision comes back if the string returns', () => {
  const existing = { version: 1, entries: [], retired: [mk('Seasonal banner copy here.', { status: 'human' })] };
  const { ledger } = merge(existing, [mk('Seasonal banner copy here.')]);
  assert.equal(ledger.entries[0].status, 'human');
  assert.equal(ledger.retired.length, 0);
});

test('the gate blocks only new copy until strict mode', () => {
  const old = mk('Old debt from before the ledger.');
  const fresh = mk('Added yesterday with no review.');
  const onDisk = { version: 1, strict: false, baseline: [old.id], entries: [old], retired: [] };
  const g = gate(onDisk, { entries: [old, fresh] });
  assert.deepEqual(g.unledgered.map((e) => e.text), ['Added yesterday with no review.']);
  assert.deepEqual(g.backlog.map((e) => e.text), ['Old debt from before the ledger.']);
  assert.equal(g.strict, false);
});

test('promote keeps the draft as the record of what was replaced', () => {
  const e = mk('A model wrote this first.', { status: 'rewritten', replacement: 'A person wrote this instead.' });
  promote(e, e.replacement);
  assert.equal(e.status, 'human');
  assert.equal(e.text, 'A person wrote this instead.');
  assert.equal(e.id, idFor('A person wrote this instead.'));
  assert.equal(e.previous_ai_text, 'A model wrote this first.');
  assert.equal(e.replacement, null);
});

test('stats keep human and ai-fine words apart', () => {
  const s = stats({ entries: [
    mk('one two three four five six', { status: 'human' }),
    mk('seven eight nine ten eleven twelve', { status: 'ai-fine' }),
    mk('thirteen fourteen fifteen sixteen seventeen eighteen'),
  ] });
  assert.equal(s.done, 2);
  assert.equal(s.wordsByStatus.human, 6);
  assert.equal(s.wordsByStatus['ai-fine'], 6);
  assert.equal(s.wordsDone, 12);
});

test('sync against real files folds identical text into one entry', async () => {
  await withProject({
    'a.md': 'Save changes\n\nA paragraph that only appears once.\n',
    'b/en.json': '{"save": "Save changes", "x": "Another catalog string."}',
  }, (project) => {
    const entries = extractEntries(project);
    const save_ = entries.find((e) => e.text === 'Save changes');
    assert.equal(save_.occurrences.length, 2);
    assert.deepEqual(save_.occurrences.map((o) => o.file), ['a.md', 'b/en.json']);
    assert.equal(save_.occurrences[1].kind, 'json-value');
  });
});

test('load, sync and save round-trip through the configured ledger path', async () => {
  await withProject({ 'README.md': '# Hello\n\nA readme sentence for the ledger.\n' }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    ledger.baseline = ledger.entries.map((e) => e.id);
    save(project, ledger);
    assert.ok(fs.existsSync(path.join(dir, 'copy', 'ledger.json')));
    const again = load(project);
    assert.equal(again.entries.length, 2);
    assert.equal(again.baseline.length, 2);
  });
});

test('a status the tool does not define fails the gate instead of passing for a decision', async () => {
  const { renderVerdict } = await import('../src/github.js');
  const odd = mk('Written into the file by hand as as-is.', { status: 'as-is' });
  const fine = mk('A string somebody decided properly.', { status: 'ai-fine' });
  const g = gate({ baseline: [] }, { entries: [odd, fine] });
  assert.equal(g.unledgered.length, 0);
  assert.deepEqual(g.unknown.map((e) => e.status), ['as-is']);

  const md = renderVerdict(g, { done: 1, total: 2, byStatus: { human: 0 } }).join('\n');
  assert.match(md, /status SlopChop does not define/);
  assert.match(md, /`as-is`/);
  assert.doesNotMatch(md, /Every string in source has an author on record/);
});

test('check exits non-zero and names the unknown status', async () => {
  const { execFileSync } = await import('node:child_process');
  await withProject({ 'a.md': 'One paragraph that somebody marked by hand.\n' }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    ledger.baseline = [];
    ledger.entries[0].status = 'as-is';
    save(project, ledger);
    fs.writeFileSync(path.join(dir, '.slopchop.json'), JSON.stringify({ include: ['a.md'] }));
    const cli = path.resolve('bin/slopchop.js');
    let out = '';
    let code = 0;
    try { execFileSync(process.execPath, [cli, 'check', '--config', path.join(dir, '.slopchop.json')], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, NO_COLOR: '1' } }); }
    catch (e) { code = e.status; out = e.stderr; }
    assert.equal(code, 1);
    assert.match(out, /status SlopChop does not know \("as-is"\)/);
    assert.match(out, /a\.md:1/);
  });
});
