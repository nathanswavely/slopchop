// "Not copy": a decision that a string is not text a person reads. Decided,
// kept through sync, left out of every total, and never out of sight.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { sync, load, save, decide, stats, gate, merge, STATUSES, CHOOSABLE, DECIDED } from '../src/ledger.js';
import { extractEntries } from '../src/extract/index.js';
import { renderReport, badge } from '../src/report.js';
import { renderVerdict } from '../src/github.js';
import { writeDrafts, pullDrafts } from '../src/drafts.js';
import { serve } from '../src/serve.js';
import { withProject } from './helpers.js';

const files = {
  'a.md': [
    'A paragraph a person wrote about the cooperative and why it exists.',
    '',
    'Order #%s shipped on %s to %s via %s.',
    '',
    'Another paragraph a model drafted that nobody has looked at yet.',
    '',
  ].join('\n'),
};

test('not-copy is its own choosable status, apart from ai-fine', () => {
  assert.ok(STATUSES.includes('not-copy'));
  assert.ok(CHOOSABLE.includes('not-copy'));
  assert.ok(!DECIDED.has('not-copy'));      // decided, but not among the counted
  const e = { status: 'unreviewed', replacement: null, note: null, text: 'x', occurrences: [] };
  decide(e, { status: 'not-copy', note: 'printf format' });
  assert.equal(e.status, 'not-copy');
  assert.equal(e.note, 'printf format');
  assert.equal(e.authorship, undefined);
});

test('check treats not-copy as decided, and sync keeps it like any other decision', async () => {
  await withProject(files, (project) => {
    const { ledger } = sync(project, load(project));
    ledger.baseline = [];
    const fmt = ledger.entries.find((e) => e.text.startsWith('Order'));
    decide(fmt, { status: 'not-copy', note: 'a format string' });
    decide(ledger.entries[0], { status: 'human' });
    decide(ledger.entries[2], { status: 'ai-fine' });
    save(project, ledger);

    const onDisk = load(project);
    const { ledger: fresh } = sync(project, onDisk);
    assert.equal(fresh.entries.find((e) => e.id === fmt.id).status, 'not-copy');
    assert.equal(fresh.entries.find((e) => e.id === fmt.id).note, 'a format string');
    const g = gate(onDisk, fresh);
    assert.equal(g.unledgered.length, 0);
    assert.equal(g.unknown.length, 0);
  });
});

test('a not-copy decision outlives its string leaving the source, and comes back with it', () => {
  const e = { id: 'abc123abc123', text: 'Order #%s', status: 'not-copy', words: 2, tier: 'label', occurrences: [{ file: 'a.md', line: 1 }] };
  const gone = merge({ version: 1, entries: [e], retired: [] }, []).ledger;
  assert.deepEqual(gone.retired.map((r) => r.status), ['not-copy']);
  const back = merge(gone, [{ ...e, status: 'unreviewed' }]).ledger;
  assert.equal(back.entries[0].status, 'not-copy');
});

test('stats leave not-copy out of every total and say how much was left out', async () => {
  await withProject(files, (project) => {
    const { ledger } = sync(project, load(project));
    const fmt = ledger.entries.find((e) => e.text.startsWith('Order'));
    decide(fmt, { status: 'not-copy' });
    decide(ledger.entries[0], { status: 'human' });
    const s = stats(ledger);
    assert.equal(s.total, 2);
    assert.equal(s.done, 1);
    assert.equal(s.pending, 1);
    assert.equal(s.words, ledger.entries.reduce((n, e) => n + e.words, 0) - fmt.words);
    assert.deepEqual(s.excluded, { total: 1, words: fmt.words });
    assert.equal(s.byStatus['not-copy'], 1);
    const tiers = Object.values(s.byTier).reduce((n, t) => n + t.total, 0);
    assert.equal(tiers, 2);

    // The badge counts the same two strings: half reviewed, half human.
    assert.equal(badge(ledger).message, '50% reviewed · 50% human');
    assert.match(renderVerdict({ unledgered: [], unknown: [], backlog: [] }, s).join('\n'), /1 marked not copy, not counted/);
  });
});

test('the report states the exclusion beside the totals and lists every not-copy string', async () => {
  await withProject(files, (project) => {
    const { ledger } = sync(project, load(project));
    assert.match(renderReport(project, ledger), /## Marked as not copy \(0\)\n\n_None\._/);

    const fmt = ledger.entries.find((e) => e.text.startsWith('Order'));
    decide(fmt, { status: 'not-copy', note: 'printf format for the order email' });
    const md = renderReport(project, ledger);
    assert.match(md, /\| \*\*Total\*\* \| \*\*2\*\* \|/);
    assert.match(md, /Not counted above: \*\*1\*\* string \(\d+ words\) marked as not copy\. Every one is listed under \[Marked as not copy\]\(#marked-as-not-copy-1\)\./);
    assert.match(md, /## Marked as not copy \(1\)/);
    assert.ok(md.includes(`- \`a.md:3\`: ${JSON.stringify(fmt.text)}`));
    assert.ok(md.includes('  - note: "printf format for the order email"'));
  });
});

test('drafts take @notcopy', async () => {
  await withProject(files, (project) => {
    const { ledger } = sync(project, load(project));
    save(project, ledger);
    writeDrafts(project, ledger);
    const fmt = ledger.entries.find((e) => e.text.startsWith('Order'));
    const draft = path.join(project.draftDir, 'a.md.md');
    const src = fs.readFileSync(draft, 'utf8');
    assert.match(src, /@notcopy/);
    fs.writeFileSync(draft, src.replace(
      new RegExp(`(<!-- copy:${fmt.id} -->\\n)[\\s\\S]*?(\\n<!-- end:${fmt.id} -->)`), '$1@notcopy$2'));
    const r = pullDrafts(project, ledger);
    assert.equal(r.notCopy, 1);
    assert.equal(ledger.entries.find((e) => e.id === fmt.id).status, 'not-copy');
  });
});

test('pull refuses a draft block that drops an expression, and leaves the entry alone', async () => {
  await withProject({ 'Seat.svelte': '<p>{count} seats are open on the council this spring.</p>\n' }, (project) => {
    const { ledger } = sync(project, load(project));
    save(project, ledger);
    writeDrafts(project, ledger);
    const [e] = ledger.entries;
    const draft = path.join(project.draftDir, 'Seat.svelte.md');
    const src = fs.readFileSync(draft, 'utf8');
    fs.writeFileSync(draft, src.replace(
      new RegExp(`(<!-- copy:${e.id} -->\\n)[\\s\\S]*?(\\n<!-- end:${e.id} -->)`), '$1Some seats are open this spring.$2'));
    const r = pullDrafts(project, ledger);
    assert.equal(r.recorded, 0);
    assert.equal(r.refused.length, 1);
    assert.match(r.refused[0].reason, /drops \{count\}/);
    assert.equal(e.status, 'unreviewed');
  });
});

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
    post.get = (p) => fetch(base + p);
    return await fn(post);
  } finally {
    console.log = log;
    server.close();
  }
}

test('the review server: not-copy in bulk, the scanner for the page, and no rewrite that breaks code', async () => {
  await withProject({ ...files, 'Seat.svelte': '<p>{count} seats are open on the council this spring.</p>\n' }, async (project, dir) => {
    const { ledger } = sync(project, load(project));
    save(project, ledger);
    const fmt = ledger.entries.find((e) => e.text.startsWith('Order'));
    const seat = ledger.entries.find((e) => e.text.includes('{count}'));

    await running(project, async (post) => {
      const bulk = await post('/api/decide-many', { ids: [fmt.id], status: 'not-copy' });
      assert.equal(bulk.status, 200);
      assert.equal(bulk.body.stats.excluded.total, 1);

      const js = await post.get('/expressions.js');
      assert.equal(js.status, 200);
      assert.match(js.headers.get('content-type'), /javascript/);
      assert.match(await js.text(), /export function expressions/);

      const bad = await post('/api/decide', { id: seat.id, status: 'rewritten', replacement: 'Some seats are open.' });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.code, 'expressions');
      assert.match(bad.body.error, /^Not saved: this drops \{count\}/);

      const good = await post('/api/decide', { id: seat.id, status: 'rewritten', replacement: 'This spring, {count} seats are open.' });
      assert.equal(good.status, 200);
      // Saved means written: into source, with the expression as it was.
      assert.equal(good.body.entry.status, 'human');
      assert.deepEqual(good.body.applied, [{ file: 'Seat.svelte', edits: 1 }]);
      assert.equal(fs.readFileSync(path.join(dir, 'Seat.svelte'), 'utf8'), '<p>This spring, {count} seats are open.</p>\n');
    });
    assert.equal(load(project).entries.find((e) => e.id === fmt.id).status, 'not-copy');
  });
});

test('decide --status not-copy records it from the command line', async () => {
  await withProject(files, (project, dir) => {
    const { ledger } = sync(project, load(project));
    save(project, ledger);
    fs.writeFileSync(path.join(dir, '.slopchop.json'), JSON.stringify({ include: ['a.md'] }));
    const cli = path.resolve('bin/slopchop.js');
    const out = execFileSync(process.execPath,
      [cli, 'decide', '--status', 'not-copy', '--max-words', '10', '--apply', '--config', path.join(dir, '.slopchop.json')],
      { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    assert.match(out, /→ not-copy/);
    const after = load(project);
    assert.deepEqual(after.entries.filter((e) => e.status === 'not-copy').map((e) => e.text), ['Order #%s shipped on %s to %s via %s.']);
  });
});
