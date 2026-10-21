// The copy disclosure `report` writes: a hash-only slop.json.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildDisclosure, writeDisclosure, previewDisclosure, classify, setBlock } from '../src/disclosure.js';
import { proposeConfig, projectFrom } from '../src/config.js';
import { slopId, STATEMENT } from '../src/slop.js';
import { withProject, read } from './helpers.js';

const entry = (text, status, over = {}) => ({ id: 'x', text, status, words: 3, tier: 'label', occurrences: [], ...over });

const ledger = {
  entries: [
    entry('Written over a draft.', 'human', { previous_ai_text: 'The draft it replaced.' }),
    entry('Mine from the start.', 'human'),
    entry("A model's rewrite, taken as is.", 'ai-revised', { previous_ai_text: 'The older draft.' }),
    entry('Fine as drafted.', 'ai-fine'),
    entry('%s of %s', 'not-copy'),
    entry('Nobody has looked.', 'unreviewed'),
    entry('The page still shows this.', 'rewritten', { replacement: 'Not applied yet.' }),
    entry('A status nobody defined.', 'made-up'),
  ],
  retired: [entry('Gone from source.', 'human')],
};

const BLOCK = { enabled: true, path: 'public/slop.json', declarant: 'Pat Example', contact: 'pat@example.com' };
const OUT_OF_SCOPE = [
  { path: 'locales/*.fr.*', reason: 'Translations follow the English.' },
  { path: 'test/', reason: '  Test fixtures.  ' },
  { path: 'more/', reason: 'Test fixtures.' },
  { path: 'no-reason/' },
];

test('a disclosure lists decided strings by ID, with no text and no locations', async () => {
  await withProject({ 'a.md': 'x\n' }, async (project) => {
    const file = await buildDisclosure(project, ledger, { now: new Date(2026, 9, 20, 23, 30) });
    assert.deepEqual(Object.keys(file), ['slop', 'declarant', 'contact', 'generated', 'statement', 'outOfScope', 'copy']);
    assert.equal(file.slop, 1);
    assert.equal(file.declarant, 'Pat Example');
    assert.equal(file.contact, 'pat@example.com');
    assert.equal(file.generated, '2026-10-20');
    assert.equal(file.statement, STATEMENT);
    assert.deepEqual(file.outOfScope, ['Translations follow the English.', 'Test fixtures.']);

    const want = {
      [await slopId('Written over a draft.')]: 'human+',
      [await slopId('Mine from the start.')]: 'human',
      [await slopId("A model's rewrite, taken as is.")]: 'ai-revised+',
      [await slopId('Fine as drafted.')]: 'ai-fine',
      [await slopId('%s of %s')]: 'not-copy',
    };
    assert.deepEqual(file.copy, want);
    assert.deepEqual(Object.keys(file.copy), Object.keys(want).sort(), 'IDs sorted, so it diffs cleanly');

    const raw = JSON.stringify(file);
    for (const e of [...ledger.entries, ...ledger.retired]) assert.ok(!raw.includes(e.text), `no text: ${e.text}`);
    assert.ok(!raw.includes('locales/') && !raw.includes('a.md'), 'no paths');
  }, { disclosure: BLOCK, outOfScope: OUT_OF_SCOPE });
});

test('unreviewed strings and pending rewrites are left out, and counted', () => {
  const c = classify(ledger);
  assert.equal(c.publish.length, 5);
  assert.equal(c.unreviewed, 1);
  assert.equal(c.pending, 1);
  assert.equal(c.other, 1);
});

test('report writes the file only when there is a block, and deletes it when the block is off', async () => {
  await withProject({ 'a.md': 'x\n' }, async (project, dir) => {
    assert.equal(await writeDisclosure(project, ledger), null);
    assert.ok(!fs.existsSync(path.join(dir, 'public/slop.json')));
  });

  await withProject({ 'a.md': 'x\n' }, async (project, dir) => {
    const r = await writeDisclosure(project, ledger);
    assert.equal(r.action, 'wrote');
    assert.equal(r.count, 5);
    assert.deepEqual(r.byStatus, { 'human+': 1, human: 1, 'ai-revised+': 1, 'ai-fine': 1, 'not-copy': 1 });
    const file = JSON.parse(read(dir, 'public/slop.json'));
    assert.equal(Object.keys(file.copy).length, 5);

    project.config.disclosure = { ...BLOCK, enabled: false };
    assert.deepEqual(await writeDisclosure(project, ledger), { action: 'removed', path: 'public/slop.json' });
    assert.ok(!fs.existsSync(path.join(dir, 'public/slop.json')));
    assert.deepEqual(await writeDisclosure(project, ledger), { action: 'off', path: 'public/slop.json' });
  }, { disclosure: BLOCK });
});

test('switched off, report leaves alone a file that is not a disclosure', async () => {
  await withProject({ 'a.md': 'x\n', 'public/slop.json': '{"something":"else"}\n' }, async (project, dir) => {
    await assert.rejects(writeDisclosure(project, ledger), /does not look like a copy disclosure/);
    assert.equal(read(dir, 'public/slop.json'), '{"something":"else"}\n');
  }, { disclosure: { ...BLOCK, enabled: false } });
});

test('a block report cannot act on is refused before anything is written', async () => {
  const cases = [
    [{ path: '../elsewhere/slop.json' }, /inside the project/],
    [{ path: 'public/copy.json' }, /called slop\.json/],
    [{ declarant: '  ' }, /declarant is required/],
    [{ contact: undefined }, /contact is required/],
  ];
  for (const [over, re] of cases) {
    await withProject({ 'a.md': 'x\n' }, async (project, dir) => {
      await assert.rejects(writeDisclosure(project, ledger), re);
      assert.ok(!fs.existsSync(path.join(dir, 'public')));
    }, { disclosure: { ...BLOCK, ...over } });
  }
  // Off, a disclosure needs no name.
  await withProject({ 'a.md': 'x\n' }, async (project) => {
    assert.equal((await writeDisclosure(project, ledger)).action, 'off');
  }, { disclosure: { enabled: false } });
});

test('path defaults to public/slop.json', async () => {
  await withProject({ 'a.md': 'x\n' }, async (project, dir) => {
    assert.equal((await writeDisclosure(project, ledger)).path, 'public/slop.json');
    assert.ok(fs.existsSync(path.join(dir, 'public/slop.json')));
  }, { disclosure: { enabled: true, declarant: 'Pat', contact: 'pat@example.com' } });
});

test('init never adds a disclosure block', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'slopchop-'));
  try {
    fs.writeFileSync(path.join(dir, 'README.md'), '# Hi\n');
    assert.ok(!('disclosure' in proposeConfig(dir).config));
    assert.equal(projectFrom({ include: ['README.md'] }, path.join(dir, '.slopchop.json')).config.disclosure, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the preview lists what would be published, and what is left out', async () => {
  await withProject({ 'a.md': 'x\n' }, async (project) => {
    const p = await previewDisclosure(project, ledger);
    assert.equal(p.disclosure.enabled, true);
    assert.equal(p.count, 5);
    assert.deepEqual(p.byStatus['human+'], [{ id: await slopId('Written over a draft.'), text: 'Written over a draft.' }]);
    assert.deepEqual(p.left, { unreviewed: 1, pending: 1 });
    assert.deepEqual(p.outOfScope, ['Translations follow the English.', 'Test fixtures.']);
    assert.equal(p.labels['human+'], 'written by a person, replacing a draft');
    assert.deepEqual(p.problems, []);
  }, { disclosure: BLOCK, outOfScope: OUT_OF_SCOPE });
});

// ------------------------------------------------------ editing the config ---

const CONFIG = `{
  "ledger": "copy/ledger.json",
  "include": [
    "README.md",
    "src/ui.html"
  ],
  "outOfScope": [
    { "path": "src/**/*.js", "reason": "Source comments, \\"quoted\\" and {braced}." },
    { "path": "test/", "reason": "Test fixtures." }
  ]
}
`;

test('the disclosure block is added without touching anything else in the config', () => {
  const out = setBlock(CONFIG, BLOCK);
  assert.ok(out.startsWith(CONFIG.slice(0, CONFIG.lastIndexOf(']') + 1)), 'everything before it is byte-for-byte');
  assert.ok(out.endsWith('\n}\n'));
  assert.deepEqual(JSON.parse(out), { ...JSON.parse(CONFIG), disclosure: BLOCK });
  assert.match(out, /\n {2}"disclosure": \{\n {4}"enabled": true,\n/);
});

test('an existing disclosure block is replaced in place', () => {
  const once = setBlock(CONFIG, BLOCK);
  const twice = setBlock(once, { ...BLOCK, enabled: false });
  assert.deepEqual(JSON.parse(twice).disclosure, { ...BLOCK, enabled: false });
  assert.equal(twice.replace('"enabled": false', '"enabled": true'), once);

  const middle = '{\n    "disclosure": { "enabled": true },\n    "include": ["a.md"]\n}\n';
  assert.equal(setBlock(middle, { enabled: false }), '{\n    "disclosure": {\n        "enabled": false\n    },\n    "include": ["a.md"]\n}\n');
});

test('an empty config gets a disclosure block too', () => {
  assert.deepEqual(JSON.parse(setBlock('{}\n', BLOCK)), { disclosure: BLOCK });
  assert.throws(() => setBlock('[]', BLOCK), /not a JSON object|could not edit/);
});
