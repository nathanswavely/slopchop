// Every way SlopChop writes into source keeps the file's bytes outside the
// replaced span exactly as they were: its line endings, LF, CRLF or a mix,
// and its trailing newline or the lack of one. The paths: a save in the
// review page, `slopchop apply`, a draft read back with pull then applied,
// and an undo from the review page.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { serve } from '../src/serve.js';
import { writeback } from '../src/writeback.js';
import { sync, load, save, decide } from '../src/ledger.js';
import { writeDrafts, pullDrafts } from '../src/drafts.js';
import { withProject } from './helpers.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'slopchop.js');

// Shaped like a services.ts: one string escapes its own quote.
const DRAFT = 'Hi, I\'m a designer who builds websites for small businesses.';
const DRAFT_RAW = 'Hi, I\\\'m a designer who builds websites for small businesses.';
const MINE = 'I\'m a designer. I build sites for small shops.';
const MINE_RAW = 'I\\\'m a designer. I build sites for small shops.';
const LINES = [
  "import type { Service } from './types';",
  '',
  'export const services: Service[] = [',
  '  {',
  "    id: 'home',",
  `    description: '${DRAFT_RAW}',`,
  "    note: 'Another sentence a model wrote that nobody touches here.',",
  '  },',
  '];',
];

/** The file with each line break picked by `eol(i)`, and maybe no final one. */
function build(eol, { trailing = true } = {}) {
  let s = '';
  LINES.forEach((line, i) => { s += line + (i < LINES.length - 1 || trailing ? eol(i) : ''); });
  return s;
}

const VARIANTS = {
  LF: build(() => '\n'),
  CRLF: build(() => '\r\n'),
  mixed: build((i) => (i % 3 === 0 ? '\r\n' : '\n')),
  'LF, no final newline': build(() => '\n', { trailing: false }),
  'CRLF, no final newline': build(() => '\r\n', { trailing: false }),
};

const FILE = 'src/services.ts';
const bytes = (dir) => fs.readFileSync(path.join(dir, FILE));

/** `before` with only the draft's span swapped for the rewrite. */
function expected(before) {
  const at = before.indexOf(DRAFT_RAW);
  assert.notEqual(at, -1);
  return Buffer.from(before.slice(0, at) + MINE_RAW + before.slice(at + DRAFT_RAW.length));
}

function setUp(project) {
  const { ledger } = sync(project, load(project));
  save(project, ledger);
  const entry = ledger.entries.find((e) => e.text === DRAFT);
  assert.ok(entry, 'the draft was found');
  return { ledger, entry };
}

async function running(project, fn) {
  const log = console.log;
  console.log = () => {};
  const server = serve(project, { port: 0, portRequested: true });
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (p, body) => {
      const r = await fetch(base + p, { method: 'POST', body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    };
    return await fn(post);
  } finally {
    console.log = log;
    server.close();
  }
}

for (const [name, before] of Object.entries(VARIANTS)) {
  test(`${name}: a save in the review page changes only the rewritten span`, async () => {
    await withProject({ [FILE]: before }, async (project, dir) => {
      const { entry } = setUp(project);
      await running(project, async (post) => {
        const r = await post('/api/decide', { id: entry.id, status: 'rewritten', replacement: MINE, kind: 'edited' });
        assert.deepEqual(r.body.applied, [{ file: FILE, edits: 1 }]);
      });
      assert.deepEqual(bytes(dir), expected(before));
    });
  });

  test(`${name}: an undo in the review page puts the file back byte for byte`, async () => {
    await withProject({ [FILE]: before }, async (project, dir) => {
      const { entry } = setUp(project);
      await running(project, async (post) => {
        const saved = await post('/api/decide', { id: entry.id, status: 'rewritten', replacement: MINE, kind: 'edited' });
        assert.deepEqual(bytes(dir), expected(before));
        const back = await post('/api/decide', { id: saved.body.entry.id, status: 'unreviewed', replacement: null, restore: true });
        assert.deepEqual(back.body.restored, [{ file: FILE, edits: 1 }]);
      });
      assert.deepEqual(bytes(dir), Buffer.from(before));
    });
  });

  test(`${name}: slopchop apply changes only the rewritten span`, async () => {
    await withProject({ [FILE]: before }, async (project, dir) => {
      fs.writeFileSync(project.configPath, JSON.stringify({ include: [FILE] }));
      const { ledger, entry } = setUp(project);
      decide(entry, { status: 'rewritten', replacement: MINE });
      save(project, ledger);
      execFileSync(process.execPath, [BIN, 'apply', '--apply', '--config', project.configPath], { cwd: dir });
      assert.deepEqual(bytes(dir), expected(before));
    });
  });

  test(`${name}: a draft read back with pull, then applied, changes only its span`, async () => {
    await withProject({ [FILE]: before }, async (project, dir) => {
      const { ledger, entry } = setUp(project);
      writeDrafts(project, ledger);
      const draft = path.join(project.draftDir, `${FILE}.md`);
      const md = fs.readFileSync(draft, 'utf8');
      const re = new RegExp(`(<!-- copy:${entry.id} -->\\r?\\n)[\\s\\S]*?(\\r?\\n<!-- end:${entry.id} -->)`);
      assert.match(md, re);
      // Edited on a machine that saves CRLF.
      fs.writeFileSync(draft, md.replace(re, `$1${MINE}$2`).replace(/\r?\n/g, '\r\n'));
      assert.equal(pullDrafts(project, ledger).recorded, 1);
      const r = writeback(project, ledger, { apply: true });
      assert.deepEqual(r.blocked.map((b) => b.reason), []);
      assert.deepEqual(bytes(dir), expected(before));
    });
  });
}
