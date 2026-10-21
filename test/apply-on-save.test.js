// The review page writes a saved rewrite into source, and puts the draft
// back when the words are moved back.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { serve } from '../src/serve.js';
import { sync, load, save, decide } from '../src/ledger.js';
import { writeDrafts } from '../src/drafts.js';
import { idFor } from '../src/extract/index.js';
import { withProject, read } from './helpers.js';

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

const DRAFT = 'A paragraph a model wrote about the product.';
const OTHER = 'Another paragraph a model wrote for the page.';
const files = {
  'a.md': `# Title\n\n${DRAFT}\n\n${OTHER}\n`,
  'b.md': 'A third paragraph, which lives in another file.\n',
};

function setUp(project) {
  const { ledger } = sync(project, load(project));
  save(project, ledger);
  return (text) => ledger.entries.find((e) => e.text === text);
}

test('a saved rewrite is written into source and recorded as the person\'s', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const draft = find(DRAFT);

    await running(project, async (post) => {
      const r = await post('/api/decide', { id: draft.id, status: 'rewritten', replacement: 'I wrote this one.', kind: 'edited' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.applied, [{ file: 'a.md', edits: 1 }]);
      assert.equal(r.body.refused, undefined);
      const e = r.body.entry;
      assert.equal(e.status, 'human');
      assert.equal(e.text, 'I wrote this one.');
      assert.equal(e.id, idFor('I wrote this one.'));
      assert.equal(e.previous_ai_text, DRAFT);
      assert.deepEqual(e.authorship, { kind: 'edited' });
      assert.equal(e.replacement, null);
      assert.equal(e.occurrences[0].raw, 'I wrote this one.');
      assert.equal(r.body.stats.byStatus.rewritten, 0);
    });

    assert.equal(read(dir, 'a.md'), `# Title\n\nI wrote this one.\n\n${OTHER}\n`);
    const onDisk = load(project).entries.find((e) => e.text === 'I wrote this one.');
    assert.equal(onDisk.status, 'human');
    // The next sync agrees with what the page recorded.
    const { ledger: fresh, added } = sync(project, load(project));
    assert.equal(added.length, 0);
    assert.equal(fresh.entries.find((e) => e.text === 'I wrote this one.').status, 'human');
  });
});

test('a model\'s suggestion saved as it is lands as ai-revised', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const ledger = load(project);
    ledger.entries.find((e) => e.text === DRAFT).suggestion = { text: 'The model tried again.' };
    save(project, ledger);

    await running(project, async (post) => {
      const r = await post('/api/decide', { id: find(DRAFT).id, status: 'rewritten', replacement: 'The model tried again.' });
      assert.equal(r.body.entry.status, 'ai-revised');
      assert.equal(r.body.entry.authorship, undefined);
    });
    assert.match(read(dir, 'a.md'), /The model tried again\./);
  });
});

test('a write source refuses keeps the rewrite as rewritten, says why, and Apply retries it', async () => {
  await withProject({ ...files, 'h.md': '## A heading a model drafted\n' }, async (project, dir) => {
    const find = setUp(project);
    const draft = find(DRAFT);
    const heading = find('A heading a model drafted');
    // The source moved after the ledger was made.
    fs.writeFileSync(path.join(dir, 'a.md'), `# Title\n\n${DRAFT.replace('product', 'thing')}\n\n${OTHER}\n`);
    const before = read(dir, 'a.md');

    await running(project, async (post) => {
      const drifted = await post('/api/decide', { id: draft.id, status: 'rewritten', replacement: 'I wrote this one.' });
      assert.equal(drifted.status, 200);
      assert.equal(drifted.body.entry.status, 'rewritten');
      assert.equal(drifted.body.entry.replacement, 'I wrote this one.');
      assert.match(drifted.body.refused, /^source drifted: no exact match/);
      assert.equal(drifted.body.applied, undefined);
      assert.equal(drifted.body.stats.byStatus.rewritten, 1);

      // A rewrite the syntax cannot hold is refused the same way.
      const broken = await post('/api/decide', { id: heading.id, status: 'rewritten', replacement: 'Two\nlines' });
      assert.match(broken.body.refused, /must stay on one line/);
      assert.equal(broken.body.entry.status, 'rewritten');

      // Put the source back, and the Apply button is the retry.
      fs.writeFileSync(path.join(dir, 'a.md'), files['a.md']);
      const applied = await post('/api/apply', { dryRun: false });
      assert.equal(applied.body.entries, 1);
      assert.equal(applied.body.blocked.length, 1);
    });
    assert.notEqual(read(dir, 'a.md'), before);
    assert.match(read(dir, 'a.md'), /I wrote this one\./);
    assert.equal(read(dir, 'h.md'), '## A heading a model drafted\n');
    assert.deepEqual(load(project).entries.map((e) => e.status).sort(), ['human', 'rewritten', 'unreviewed', 'unreviewed', 'unreviewed']);
  });
});

test('a checked-out string is not written', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    writeDrafts(project, load(project), { file: 'b.md' });
    const held = find('A third paragraph, which lives in another file.');

    await running(project, async (post) => {
      const r = await post('/api/decide', { id: held.id, status: 'rewritten', replacement: 'Mine now.' });
      assert.equal(r.status, 409);
      assert.equal(r.body.code, 'checked-out');
    });
    assert.equal(read(dir, 'b.md'), files['b.md']);
    assert.equal(load(project).entries.find((e) => e.id === held.id).status, 'unreviewed');
  });
});

test('moving applied words back puts the draft back into source, after asking', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const draftId = find(DRAFT).id;

    await running(project, async (post) => {
      const saved = await post('/api/decide', { id: draftId, status: 'rewritten', replacement: 'I wrote this one.' });
      const id = saved.body.entry.id;

      const asked = await post('/api/decide', { id, status: 'unreviewed', replacement: null });
      assert.equal(asked.status, 409);
      assert.equal(asked.body.code, 'restore');
      assert.match(read(dir, 'a.md'), /I wrote this one\./);

      const back = await post('/api/decide', { id, status: 'unreviewed', replacement: null, restore: true });
      assert.equal(back.status, 200);
      assert.deepEqual(back.body.restored, [{ file: 'a.md', edits: 1 }]);
      const e = back.body.entry;
      assert.equal(e.id, draftId);
      assert.equal(e.text, DRAFT);
      assert.equal(e.status, 'unreviewed');
      assert.equal(e.previous_ai_text, undefined);
      assert.equal(e.authorship, undefined);
    });

    assert.equal(read(dir, 'a.md'), files['a.md']);
    const { added } = sync(project, load(project));
    assert.equal(added.length, 0);
  });
});

test('re-editing applied words writes over them, and the draft is not a rewrite', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);

    await running(project, async (post) => {
      const first = await post('/api/decide', { id: find(DRAFT).id, status: 'rewritten', replacement: 'I wrote this one.' });
      const second = await post('/api/decide', { id: first.body.entry.id, status: 'rewritten', replacement: 'I wrote this one, twice.' });
      assert.equal(second.body.entry.status, 'human');
      assert.equal(second.body.entry.previous_ai_text, DRAFT);
      assert.match(read(dir, 'a.md'), /^I wrote this one, twice\.$/m);

      // Typing the draft back in is not your writing; u is how it goes back.
      const same = await post('/api/decide', { id: second.body.entry.id, status: 'rewritten', replacement: `  ${DRAFT} ` });
      assert.equal(same.status, 400);
      assert.equal(same.body.code, 'draft');

      // "Leave as drafted" is a claim about the draft too.
      const fine = await post('/api/decide', { id: second.body.entry.id, status: 'ai-fine', replacement: null, restore: true });
      assert.equal(fine.body.entry.status, 'ai-fine');
      assert.equal(fine.body.entry.text, DRAFT);

      // Not copy is a claim about the string, not who wrote it: no undo.
      const again = await post('/api/decide', { id: find(OTHER).id, status: 'rewritten', replacement: 'Mine as well.' });
      const nc = await post('/api/decide', { id: again.body.entry.id, status: 'not-copy', replacement: null });
      assert.equal(nc.status, 200);
      assert.equal(nc.body.entry.text, 'Mine as well.');
    });
    assert.equal(read(dir, 'a.md'), `# Title\n\n${DRAFT}\n\nMine as well.\n`);
  });
});

test('an undo the source no longer allows says so and changes nothing', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);

    await running(project, async (post) => {
      const saved = await post('/api/decide', { id: find(DRAFT).id, status: 'rewritten', replacement: 'I wrote this one.' });
      // Edited again by hand after the save.
      fs.writeFileSync(path.join(dir, 'a.md'), read(dir, 'a.md').replace('I wrote this one.', 'I wrote this one, by hand.'));
      const before = read(dir, 'a.md');

      const r = await post('/api/decide', { id: saved.body.entry.id, status: 'unreviewed', replacement: null, restore: true });
      assert.equal(r.status, 409);
      assert.equal(r.body.code, 'cannot-restore');
      assert.match(r.body.error, /^Nothing changed: source drifted/);
      assert.equal(read(dir, 'a.md'), before);
      assert.equal(load(project).entries.find((e) => e.id === saved.body.entry.id).status, 'human');
    });
  });
});

test('moving many applied strings back puts every draft back, or none', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const b = 'A third paragraph, which lives in another file.';

    await running(project, async (post) => {
      const one = await post('/api/decide', { id: find(DRAFT).id, status: 'rewritten', replacement: 'First of mine.' });
      const two = await post('/api/decide', { id: find(b).id, status: 'rewritten', replacement: 'Second of mine.' });
      const ids = [one.body.entry.id, two.body.entry.id, find(OTHER).id];

      const asked = await post('/api/decide-many', { ids, status: 'unreviewed' });
      assert.equal(asked.status, 409);
      assert.equal(asked.body.count, 2);

      // One of them moved by hand: nothing at all changes.
      fs.writeFileSync(path.join(dir, 'b.md'), 'Second of mine, edited.\n');
      const refused = await post('/api/decide-many', { ids, status: 'unreviewed', restore: true });
      assert.equal(refused.body.code, 'cannot-restore');
      assert.match(read(dir, 'a.md'), /First of mine\./);

      fs.writeFileSync(path.join(dir, 'b.md'), 'Second of mine.\n');
      const r = await post('/api/decide-many', { ids, status: 'unreviewed', restore: true });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.was, ids);
      assert.deepEqual(r.body.entries.map((e) => e.text), [DRAFT, b, OTHER]);
      assert.deepEqual(r.body.restored.map((f) => f.file), ['a.md', 'b.md']);
    });
    assert.equal(read(dir, 'a.md'), files['a.md']);
    assert.equal(read(dir, 'b.md'), files['b.md']);
  });
});

test('a second page saving the same string finds it gone, and the file is written once', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const id = find(DRAFT).id;

    await running(project, async (post) => {
      const [x, y] = await Promise.all([
        post('/api/decide', { id, status: 'rewritten', replacement: 'From the first page.' }),
        post('/api/decide', { id, status: 'rewritten', replacement: 'From the second page.' }),
      ]);
      const ok = [x, y].filter((r) => r.status === 200);
      assert.equal(ok.length, 1);
      assert.equal([x, y].find((r) => r.status !== 200).body.code, 'gone');
    });
    const text = read(dir, 'a.md');
    assert.equal((text.match(/From the/g) || []).length, 1);
    assert.ok(!text.includes(DRAFT));
  });
});

test('a file that changes between the plan and the write is not written', async () => {
  await withProject(files, async (project, dir) => {
    const find = setUp(project);
    const { writeback } = await import('../src/writeback.js');
    const ledger = load(project);
    decide(ledger.entries.find((e) => e.id === find(DRAFT).id), { status: 'rewritten', replacement: 'Mine.' });

    // Another page writes a.md after this plan read it and before it writes.
    const real = fs.readFileSync;
    let reads = 0;
    fs.readFileSync = function (p, ...rest) {
      if (String(p).endsWith('a.md') && ++reads === 2) real.call(fs, p, ...rest) && fs.writeFileSync(p, 'Someone else.\n');
      return real.call(fs, p, ...rest);
    };
    let r;
    try { r = writeback(project, ledger, { apply: true }); }
    finally { fs.readFileSync = real; }

    assert.equal(r.entries, 0);
    assert.match(r.blocked[0].reason, /^a\.md changed while this was being written/);
    assert.equal(read(dir, 'a.md'), 'Someone else.\n');
    assert.equal(ledger.entries.find((e) => e.replacement === 'Mine.').status, 'rewritten');
  });
});
