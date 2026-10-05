// The review server's bulk decision, which the page's multi-select uses.

import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { serve } from '../src/serve.js';
import { sync, load, save, decide } from '../src/ledger.js';
import { writeDrafts } from '../src/drafts.js';
import { withProject } from './helpers.js';

async function running(project, fn) {
  const log = console.log;
  console.log = () => {};
  const server = serve(project, { port: 0, portRequested: true });
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (path, body) => {
      const r = await fetch(base + path, { method: 'POST', body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    };
    post.get = (path) => fetch(base + path);
    return await fn(post);
  } finally {
    console.log = log;
    server.close();
  }
}

const files = {
  'a.md': 'First paragraph a model wrote for us.\n\nSecond paragraph a model wrote for us.\n',
  'b.md': 'Third paragraph, which lives in another file.\n',
};

test('decide-many records one answer for many strings', async () => {
  await withProject(files, async (project) => {
    const { ledger } = sync(project, load(project));
    decide(ledger.entries[1], { status: 'rewritten', replacement: 'A rewrite nobody applied.' });
    save(project, ledger);
    const ids = ledger.entries.map((e) => e.id);

    await running(project, async (post) => {
      const r = await post('/api/decide-many', { ids: ids.slice(0, 2), status: 'ai-fine' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.entries.map((e) => e.status), ['ai-fine', 'ai-fine']);
      assert.equal(r.body.entries[1].replacement, null);
      assert.equal(r.body.stats.done, 2);

      assert.equal((await post('/api/decide-many', { ids, status: 'ai-revised' })).status, 400);
      assert.equal((await post('/api/decide-many', { ids, status: 'rewritten' })).status, 400);
      assert.equal((await post('/api/decide-many', { ids: [], status: 'human' })).status, 400);
      assert.equal((await post('/api/decide-many', { ids: ['nope'], status: 'human' })).status, 404);
    });

    const after = load(project);
    assert.deepEqual(after.entries.map((e) => e.status), ['ai-fine', 'ai-fine', 'unreviewed']);
  });
});

test('the vendored design system is served by name, and nothing else is', async () => {
  await withProject(files, async (project) => {
    await running(project, async (post) => {
      const css = await post.get('/lt/foundation.css');
      assert.equal(css.status, 200);
      assert.match(css.headers.get('content-type'), /text\/css/);
      assert.match(await css.text(), /--lt-color-primary/);
      const js = await post.get('/lt/behaviors.js');
      assert.match(js.headers.get('content-type'), /javascript/);
      for (const bad of ['/lt/LICENSE', '/lt/README.md', '/lt/../serve.js', '/lt/%2e%2e/serve.js', '/lt/']) {
        assert.equal((await post.get(bad)).status, 404, bad);
      }
    });
  });
});

test('decide-many changes nothing when a string is checked out, unless forced', async () => {
  await withProject(files, async (project) => {
    const { ledger } = sync(project, load(project));
    save(project, ledger);
    writeDrafts(project, load(project), { file: 'b.md' });
    const ids = ledger.entries.map((e) => e.id);

    await running(project, async (post) => {
      const refused = await post('/api/decide-many', { ids, status: 'human' });
      assert.equal(refused.status, 409);
      assert.equal(refused.body.code, 'checked-out');
      assert.deepEqual(refused.body.held.map((h) => h.source), ['b.md']);
      assert.deepEqual(load(project).entries.map((e) => e.status), ['unreviewed', 'unreviewed', 'unreviewed']);

      const forced = await post('/api/decide-many', { ids, status: 'human', force: true });
      assert.equal(forced.status, 200);
      assert.equal(forced.body.entries.length, 3);
    });
  });
});
