// Markdown headings: recorded as a page shows them, without their `#` marks,
// and rewritten between those marks.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { extractOne, idFor } from '../src/extract/index.js';
import { load, save, sync, gate } from '../src/ledger.js';
import { writeback, previewLines } from '../src/writeback.js';
import { buildDisclosure } from '../src/disclosure.js';
import { readPage } from '../src/reader.js';
import { withProject, read } from './helpers.js';

const texts = (src) => extractOne('a.md', 'md', src).map((h) => h.text);

test('a heading is recorded without its # marks, and its raw is the words alone', () => {
  const src = '# Title\n\nIntro paragraph for the page.\n\n## How it works ##\n\n###   Spaced out   \n';
  const hits = extractOne('a.md', 'md', src);
  assert.deepEqual(hits.map((h) => h.text), ['Title', 'Intro paragraph for the page.', 'How it works', 'Spaced out']);
  const h = hits.find((x) => x.text === 'How it works');
  assert.equal(h.kind, 'md-heading');
  assert.equal(h.raw, 'How it works');
  assert.equal(h.line, 5);
  assert.equal(hits.find((x) => x.text === 'Spaced out').raw, 'Spaced out');
});

test('a heading with no blank line after it is its own string, apart from its paragraph', () => {
  const hits = extractOne('a.md', 'md', 'Opening words of the page.\n## Pricing\nNo tiers and no bundles here.\n');
  assert.deepEqual(hits.map((h) => [h.text, h.kind, h.line]), [
    ['Opening words of the page.', 'md-block', 1],
    ['Pricing', 'md-heading', 2],
    ['No tiers and no bundles here.', 'md-block', 3],
  ]);
});

test('a setext heading is a heading; a rule under a list item is not', () => {
  assert.deepEqual(texts('Getting started\n===============\n\nFirst you install it.\n'), ['Getting started', 'First you install it.']);
  assert.deepEqual(texts('- one item here\n- two items here\n---\n'), ['- one item here\n- two items here\n---']);
});

test('a # without a space, or inside a code fence, is not a heading', () => {
  assert.deepEqual(texts('#hashtags are words here\n'), ['#hashtags are words here']);
  assert.deepEqual(texts('```sh\n# a shell comment here\n```\n'), []);
});

test('a heading rewrite lands between the marks, which stay', async () => {
  const src = '# SlopChop\n\nA tool.\n\n## How it works ##\n\nThe body text goes here.\n';
  await withProject({ 'README.md': src }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    const e = ledger.entries.find((x) => x.text === 'How it works');
    e.status = 'rewritten';
    e.replacement = 'What it does';
    const { changes } = previewLines(project, ledger);
    assert.deepEqual(changes.map((c) => c.after), ['## What it does ##']);
    const r = writeback(project, ledger, { apply: true });
    assert.equal(r.blocked.length, 0);
    assert.equal(read(dir, 'README.md'), src.replace('How it works', 'What it does'));
    assert.equal(e.text, 'What it does');
    assert.equal(e.previous_ai_text, 'How it works');
    // And the next sync finds it where apply left it.
    const again = sync(project, ledger).ledger.entries.find((x) => x.text === 'What it does');
    assert.equal(again.status, 'human');
  });
});

test('a heading replacement that would break the heading is refused', async () => {
  await withProject({ 'README.md': '## How it works\n' }, (project) => {
    for (const replacement of ['Two\nlines', '## What it does']) {
      const { ledger } = sync(project, load(project));
      Object.assign(ledger.entries[0], { status: 'rewritten', replacement });
      const r = writeback(project, ledger);
      assert.equal(r.blocked.length, 1, replacement);
    }
  });
});

// A ledger as SlopChop 0.3 wrote it: headings with their marks, one heading
// sharing an entry with the paragraph under it.
function legacyLedger() {
  const md = (text, line, over = {}) => ({
    id: idFor(text), text, words: 1, tier: 'label', status: 'unreviewed', replacement: null, note: null,
    occurrences: [{ file: 'README.md', line, kind: 'md-block', raw: text, quote: null }], ...over,
  });
  return {
    version: 1, strict: false,
    entries: [
      md('# SlopChop', 1, { status: 'ai-fine', note: 'the name' }),
      md('A paragraph a person wrote for the readme.', 3, { status: 'human', authorship: { kind: 'claimed' } }),
      md('## How it works', 5, {
        status: 'human', authorship: { kind: 'written' }, previous_ai_text: '## How SlopChop works', note: 'shorter',
      }),
      md('## Setting it up', 7, { status: 'rewritten', replacement: '## Getting set up', authorship: { kind: 'written' } }),
      md('## Next', 9),
      md('## Pricing\nNo tiers and no bundles here.', 11, { status: 'ai-fine' }),
    ],
    retired: [],
    baseline: [idFor('## Next')],
  };
}

const LEGACY_README = [
  '# SlopChop', '', 'A paragraph a person wrote for the readme.', '',
  '## How it works', '', '## Setting it up', '', '## Next', '',
  '## Pricing', 'No tiers and no bundles here.', '',
].join('\n');

test('a ledger from before the fix keeps every heading decision under the new IDs', async () => {
  await withProject({ 'README.md': LEGACY_README }, (project, dir) => {
    fs.mkdirSync(path.join(dir, 'copy'));
    fs.writeFileSync(project.ledgerPath, JSON.stringify(legacyLedger(), null, 2));

    const onDisk = load(project);
    const { ledger, added } = sync(project, onDisk);
    assert.deepEqual(added, [], 'nothing comes up as new');
    assert.deepEqual(ledger.retired, [], 'nothing is orphaned');

    const by = (t) => ledger.entries.find((e) => e.text === t);
    assert.ok(!ledger.entries.some((e) => e.text.startsWith('#')));

    assert.equal(by('SlopChop').id, idFor('SlopChop'));
    assert.equal(by('SlopChop').status, 'ai-fine');
    assert.equal(by('SlopChop').note, 'the name');
    assert.equal(by('SlopChop').occurrences[0].kind, 'md-heading');

    const how = by('How it works');
    assert.equal(how.status, 'human');
    assert.deepEqual(how.authorship, { kind: 'written' });
    assert.equal(how.note, 'shorter');
    assert.equal(how.previous_ai_text, 'How SlopChop works');

    const setup = by('Setting it up');
    assert.equal(setup.status, 'rewritten');
    assert.equal(setup.replacement, 'Getting set up');

    // A heading and its paragraph, once one entry, now two, each decided.
    assert.equal(by('Pricing').status, 'ai-fine');
    assert.equal(by('No tiers and no bundles here.').status, 'ai-fine');

    // Baseline debt follows its heading, so check still passes.
    assert.deepEqual(ledger.baseline, [idFor('Next')]);
    const g = gate(onDisk, ledger);
    assert.deepEqual(g.unledgered.map((e) => e.text), []);
    assert.deepEqual(g.backlog.map((e) => e.text), ['Next']);

    // The carried-over rewrite still applies, and keeps its marks.
    const r = writeback(project, ledger, { apply: true });
    assert.equal(r.blocked.length, 0);
    assert.match(read(dir, 'README.md'), /^## Getting set up$/m);
    save(project, ledger);
    assert.equal(sync(project, load(project)).added.length, 0);
  });
});

test('migration is idempotent and leaves a current ledger alone', async () => {
  await withProject({ 'README.md': LEGACY_README }, (project, dir) => {
    fs.mkdirSync(path.join(dir, 'copy'));
    fs.writeFileSync(project.ledgerPath, JSON.stringify(legacyLedger(), null, 2));
    const once = sync(project, load(project)).ledger;
    const twice = sync(project, once).ledger;
    assert.deepEqual(twice, once);
  });
});

test('a Reader finds a Markdown heading on the rendered page', async () => {
  const readme = '# SlopChop\n\nCopy review for a site you built.\n\n## A copy disclosure, for a site whose source is closed\n';
  await withProject({ 'README.md': readme }, async (project) => {
    const { ledger } = sync(project, load(project));
    for (const e of ledger.entries) e.status = 'ai-fine';
    const d = await buildDisclosure(project, ledger, { block: { enabled: true } });
    const page = '<main><h1>SlopChop</h1><p>Copy review for a site you built.</p>'
      + '<h2 id="a-copy-disclosure">A copy disclosure, for a site whose source is closed</h2></main>';
    const r = await readPage(page, d);
    assert.deepEqual(r.undeclared.map((x) => x.text), []);
    assert.deepEqual(r.declared.map((x) => x.text), [
      'SlopChop', 'Copy review for a site you built.', 'A copy disclosure, for a site whose source is closed',
    ]);
  });
});
