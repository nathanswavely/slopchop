// The pull request summary, which is the default, the inline comments,
// which are opt-in, and a check that fails on a rewrite not in source.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { summaryBody, renderVerdict } from '../src/github.js';
import { sync, load, save, decide, gate, stats } from '../src/ledger.js';
import { withProject } from './helpers.js';

const run = promisify(execFile);
const CLI = path.resolve('bin/slopchop.js');

const NEW = 'A sentence this pull request added to the page.';
const DRAFT = 'A paragraph a model wrote about the product.';
const files = { 'a.md': `# Title\n\n${DRAFT}\n\n${NEW}\n` };

/** A ledger with one rewrite not in source, and one new string undecided. */
function setUp(project, dir) {
  fs.writeFileSync(path.join(dir, '.slopchop.json'), JSON.stringify({ include: ['a.md'] }));
  const { ledger } = sync(project, load(project));
  ledger.baseline = ledger.entries.filter((e) => e.text !== NEW).map((e) => e.id);
  decide(ledger.entries.find((e) => e.text === 'Title'), { status: 'ai-fine' });
  decide(ledger.entries.find((e) => e.text === DRAFT), { status: 'rewritten', replacement: 'I wrote this one.' });
  save(project, ledger);
  return ledger;
}

const verdict = (project) => {
  const onDisk = load(project);
  const { ledger: fresh } = sync(project, onDisk);
  return { g: gate(onDisk, fresh), s: stats(fresh) };
};

const cli = (dir, args, env = {}) => run(process.execPath, [CLI, ...args, '--config', path.join(dir, '.slopchop.json')], {
  cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', GITHUB_STEP_SUMMARY: '', ...env },
}).then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));

test('the summary lists new strings and unapplied rewrites, each linked to its line', async () => {
  await withProject(files, async (project, dir) => {
    setUp(project, dir);
    const { g, s } = verdict(project);
    const link = (file, line) => `https://example.test/${file}#L${line}`;
    const body = summaryBody('.', g, s, { link });

    assert.match(body, /^<!-- slopchop:summary:\. -->/);
    assert.match(body, /\*\*1 new string\*\* entered the source without a recorded author\./);
    assert.match(body, /\| \[`a\.md:5`\]\(https:\/\/example\.test\/a\.md#L5\) \| A sentence this pull request added/);
    assert.match(body, /\*\*1 rewrite\*\* is recorded in the ledger and not in the source yet\./);
    assert.match(body, /\| \[`a\.md:3`\]\(https:\/\/example\.test\/a\.md#L3\) \| I wrote this one\. \|/);
    assert.match(body, /Run `slopchop apply --apply` locally and commit the result\.$/m);
    assert.ok(!/suggestion/.test(body), 'no suggestions to point at when inline is off');
    assert.ok(!/Everything is settled/.test(body));
    assert.match(summaryBody('.', g, s, { inline: true }), /or commit the suggestions on those lines\./);
  });
});

test('once nothing is waiting, the summary says everything is settled', () => {
  const L = renderVerdict({ unledgered: [], unknown: [], backlog: [], pendingApply: [] }, { done: 3, total: 3, byStatus: { human: 1 } });
  assert.equal(L[0], 'Everything is settled: every string in source has an author on record, and every rewrite in the ledger is in the source.');
});

test('check fails on a rewrite not in source, and says how to fix it', async () => {
  await withProject(files, async (project, dir) => {
    setUp(project, dir);
    const ledger = load(project);
    decide(ledger.entries.find((e) => e.text === NEW), { status: 'ai-fine' });
    save(project, ledger);
    const summary = path.join(dir, 'summary.md');

    const r = await cli(dir, ['check'], { GITHUB_STEP_SUMMARY: summary });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /✗ 1 rewrite is recorded in the ledger and not in the source:/);
    assert.match(r.stderr, /a\.md:3\n {4}"I wrote this one\."/);
    assert.match(r.stderr, /slopchop apply --apply/);
    assert.match(fs.readFileSync(summary, 'utf8'), /\| `a\.md:3` \| I wrote this one\. \|/);

    const j = await cli(dir, ['check', '--json']);
    assert.equal(j.code, 1);
    const out = JSON.parse(j.stdout);
    assert.equal(out.ok, false);
    assert.deepEqual(out.pendingApply.map((p) => [p.file, p.line, p.replacement]), [['a.md', 3, 'I wrote this one.']]);

    // Applied, it passes.
    assert.equal((await cli(dir, ['apply', '--apply'])).code, 0);
    const ok = await cli(dir, ['check']);
    assert.equal(ok.code, 0, ok.stderr);
  });
});

/** Enough of the GitHub REST API for `comment`, recording every call. */
async function fakeGitHub() {
  const calls = [];
  const patch = '@@ -1,3 +1,5 @@\n # Title\n \n-Old.\n+A paragraph a model wrote about the product.\n+\n+A sentence this pull request added to the page.';
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      calls.push({ method: req.method, path: url.pathname, body: data ? JSON.parse(data) : null });
      const reply = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (req.method === 'GET' && url.pathname.endsWith('/pulls/3/files')) return reply([{ filename: 'a.md', patch }]);
      if (req.method === 'GET') return reply([]);
      reply({});
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { calls, server, api: `http://127.0.0.1:${server.address().port}` };
}

async function comment(dir, args) {
  const gh = await fakeGitHub();
  const event = path.join(dir, 'event.json');
  fs.writeFileSync(event, JSON.stringify({ pull_request: { number: 3, head: { sha: 'abc123' } } }));
  try {
    const r = await cli(dir, ['comment', ...args], {
      GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_EVENT_PATH: event,
      GITHUB_API_URL: gh.api, GITHUB_WORKSPACE: dir, GITHUB_ACTIONS: '',
    });
    assert.equal(r.code, 0, r.stderr);
    return gh.calls;
  } finally {
    gh.server.close();
  }
}

test('comment posts the summary only, unless inline comments are asked for', async () => {
  await withProject(files, async (project, dir) => {
    setUp(project, dir);

    const quiet = await comment(dir, []);
    const posted = quiet.filter((c) => c.method !== 'GET');
    assert.deepEqual(posted.map((c) => `${c.method} ${c.path}`), ['POST /repos/o/r/issues/3/comments']);
    assert.match(posted[0].body.body, /^<!-- slopchop:summary:\. -->/);
    assert.match(posted[0].body.body, /I wrote this one\./);
    // Inline comments from earlier runs are left alone: not even read.
    assert.ok(!quiet.some((c) => c.path.includes('/pulls/')), 'nothing under /pulls/');

    const loud = await comment(dir, ['--inline']);
    const review = loud.find((c) => c.method === 'POST' && c.path.endsWith('/pulls/3/reviews'));
    assert.ok(review, 'a review with inline comments');
    const bodies = review.body.comments.map((c) => c.body);
    assert.ok(bodies.some((b) => b.startsWith('<!-- slopchop:new:')));
    assert.ok(bodies.some((b) => b.includes('```suggestion\nI wrote this one.\n```')));
  });
});
