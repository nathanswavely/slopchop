// Pull request comments, suggestion blocks, and a rewrite that lands
// through one.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  commentableLines, splitUnifiedDiff, planComments, publish, summaryBody,
} from '../src/github.js';
import { previewLines } from '../src/writeback.js';
import { sync, load, save, gate, decide, merge } from '../src/ledger.js';
import { idFor } from '../src/extract/index.js';
import { withProject, read } from './helpers.js';

const PATCH = [
  '@@ -1,3 +1,4 @@',
  ' # Title',
  '+A brand new line.',
  ' ',
  '-Old line.',
  '+Replacement line.',
  '@@ -20,2 +21,2 @@',
  ' context',
  '+added',
  '\\ No newline at end of file',
].join('\n');

test('commentable lines follow the right side, hunk by hunk', () => {
  const lines = commentableLines(PATCH);
  assert.deepEqual([...lines.keys()], [1, 2, 3, 4, 21, 22]);
  assert.equal(lines.get(4), 0);
  assert.equal(lines.get(21), 1);
  assert.equal(commentableLines(undefined).size, 0);
});

test('a git diff splits into one patch per file, skipping deletions', () => {
  const files = splitUnifiedDiff([
    'diff --git a/a.md b/a.md', 'index 1..2 100644', '--- a/a.md', '+++ b/a.md', PATCH,
    'diff --git a/gone.md b/gone.md', 'deleted file mode 100644', '--- a/gone.md', '+++ /dev/null', '@@ -1 +0,0 @@', '-bye',
  ].join('\n'));
  assert.deepEqual(Object.keys(files), ['a.md']);
  assert.equal(commentableLines(files['a.md']).size, 6);
});

const entry = (text, file, line, over = {}) => ({
  id: idFor(text), text, status: 'unreviewed', occurrences: [{ file, line }], ...over,
});

test('new strings get a comment where the diff can hold one, and a summary line otherwise', () => {
  const inDiff = entry('A sentence the pull request added.', 'content/a.md', 2);
  const outside = entry('A sentence nowhere near the diff.', 'content/a.md', 90);
  const diff = new Map([['site/content/a.md', commentableLines(PATCH)]]);
  const plan = planComments({ unledgered: [inDiff, outside], changes: [], diff, prefix: 'site' });
  assert.equal(plan.inline.length, 1);
  assert.equal(plan.inline[0].path, 'site/content/a.md');
  assert.equal(plan.inline[0].line, 2);
  assert.match(plan.inline[0].body, /^<!-- slopchop:new:[0-9a-f]+:site\/content\/a\.md -->/);
  assert.match(plan.inline[0].body, /> A sentence the pull request added\./);
  assert.deepEqual(plan.outsideDiff, [outside]);
});

test('a string already commented on is not commented on twice, and is settled once decided', () => {
  const e = entry('A sentence the pull request added.', 'a.md', 2);
  const diff = new Map([['a.md', commentableLines(PATCH)]]);
  const first = planComments({ unledgered: [e], changes: [], diff });
  const existing = [{ id: 7, body: first.inline[0].body }];

  const again = planComments({ unledgered: [e], changes: [], diff, existing });
  assert.equal(again.inline.length, 0);
  assert.equal(again.settle.length, 0);

  const decided = planComments({ unledgered: [], changes: [], diff, existing, entries: [{ ...e, status: 'human' }] });
  assert.equal(decided.settle.length, 1);
  assert.equal(decided.settle[0].id, 7);
  assert.match(decided.settle[0].body, /^<!-- slopchop:settled:/);
  assert.match(decided.settle[0].body, /Decided in the ledger\./);
  assert.match(decided.settle[0].body, /> A sentence the pull request added\./);

  const gone = planComments({ unledgered: [], changes: [], diff, existing, entries: [] });
  assert.match(gone.settle[0].body, /No longer in the source\./);

  // A settled comment stays settled.
  const after = planComments({ unledgered: [], changes: [], diff, existing: [{ id: 7, body: decided.settle[0].body }] });
  assert.equal(after.settle.length, 0);
});

test('a suggestion only goes where every line it replaces is in one hunk', () => {
  const diff = new Map([['a.md', commentableLines(PATCH)]]);
  const change = (startLine, endLine) => ({ file: 'a.md', ids: ['abc'], startLine, endLine, before: 'x', after: 'Written by hand.' });
  const plan = planComments({ unledgered: [], changes: [change(2, 2), change(3, 4), change(4, 21), change(50, 50)], diff });
  assert.deepEqual(plan.inline.map((c) => [c.start_line, c.line]), [[undefined, 2], [3, 4]]);
  assert.match(plan.inline[0].body, /```suggestion\nWritten by hand\.\n```$/);
});

test('a suggestion fence outgrows any backticks in the rewrite', () => {
  const diff = new Map([['a.md', commentableLines(PATCH)]]);
  const after = 'Run ```slopchop``` first.';
  const plan = planComments({ unledgered: [], changes: [{ file: 'a.md', ids: ['abc'], startLine: 2, endLine: 2, after }], diff });
  assert.match(plan.inline[0].body, /\n````suggestion\nRun ```slopchop``` first\.\n````$/);
});

test('previewLines turns pending rewrites into whole-line replacements', async () => {
  await withProject({
    'a.md': '# Title\n\nThe model wrote this paragraph about our product.\n',
    'en.json': '{\n  "a": "Save your changes now", "b": "Discard every change now"\n}\n',
  }, (project) => {
    const { ledger } = sync(project, load(project));
    const find = (t) => ledger.entries.find((e) => e.text === t);
    decide(find('The model wrote this paragraph about our product.'), { status: 'rewritten', replacement: 'I wrote this one.' });
    decide(find('Save your changes now'), { status: 'rewritten', replacement: 'Save "it"' });
    decide(find('Discard every change now'), { status: 'rewritten', replacement: 'Throw it out' });

    const { changes, blocked } = previewLines(project, ledger);
    assert.equal(blocked.length, 0);
    const md = changes.find((c) => c.file === 'a.md');
    assert.deepEqual([md.startLine, md.endLine, md.after], [3, 3, 'I wrote this one.']);
    // Two rewrites on one line become one change, with JSON escaping.
    const json = changes.find((c) => c.file === 'en.json');
    assert.equal(json.ids.length, 2);
    assert.equal(json.after, '  "a": "Save \\"it\\"", "b": "Throw it out"');
  });
});

test('a rewrite committed as a suggestion is recorded as the person\'s, and passes check', async () => {
  await withProject({ 'a.md': '# Title\n\nThe model wrote this paragraph about our product.\n' }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    ledger.baseline = ledger.entries.map((e) => e.id);
    const draft = ledger.entries.find((e) => e.tier === 'helper' || e.words > 3);
    decide(draft, { status: 'rewritten', replacement: 'I wrote this one myself.', note: 'mine' });
    save(project, ledger);

    // "Commit suggestion" on GitHub: the lines change, the ledger does not.
    const [ch] = previewLines(project, ledger).changes;
    const lines = read(dir, 'a.md').split('\n');
    lines.splice(ch.startLine - 1, ch.endLine - ch.startLine + 1, ch.after);
    fs.writeFileSync(path.join(dir, 'a.md'), lines.join('\n'));

    const onDisk = load(project);
    const { ledger: fresh, landed, added } = sync(project, onDisk);
    assert.equal(added.length, 0);
    assert.equal(landed.length, 1);
    const mine = fresh.entries.find((e) => e.text === 'I wrote this one myself.');
    assert.equal(mine.status, 'human');
    assert.equal(mine.note, 'mine');
    assert.equal(mine.previous_ai_text, 'The model wrote this paragraph about our product.');
    assert.equal(fresh.retired.length, 0);
    assert.equal(gate(onDisk, fresh).unledgered.length, 0);
  });
});

test('a rewrite that landed in one place of two leaves the other pending', () => {
  const text = 'Drafted twice across the site.';
  const mine = 'Written once by hand.';
  const existing = {
    version: 1, retired: [],
    entries: [{ ...entry(text, 'a.md', 1), status: 'rewritten', replacement: mine }],
  };
  const { ledger, landed } = merge(existing, [entry(text, 'b.md', 1), entry(mine, 'a.md', 1)]);
  assert.equal(landed.length, 1);
  assert.deepEqual(ledger.entries.map((e) => e.status), ['rewritten', 'human']);
});

// ---------------------------------------------------------------- publish ---

function fakeGitHub({ comments = [], failReview = false } = {}) {
  const calls = [];
  const gh = async (method, url, body) => {
    calls.push({ method, url, body });
    if (failReview && url.endsWith('/reviews')) { const e = new Error('422'); e.status = 422; throw e; }
    if (failReview && url.endsWith('/comments') && body?.line === 99) { const e = new Error('bad line'); e.status = 422; throw e; }
    return {};
  };
  gh.all = async (url) => { calls.push({ method: 'GET', url }); return url.includes('/issues/') ? comments : []; };
  return { gh, calls };
}

const g0 = { unledgered: [], backlog: [], pendingApply: [] };
const s0 = { done: 1, total: 1, byStatus: { human: 1 } };

test('publish posts a summary once, then edits it in place', async () => {
  const summary = summaryBody('.', g0, s0);
  const plan = { inline: [], settle: [] };

  const fresh = fakeGitHub();
  await publish({ gh: fresh.gh, repo: 'o/r', pr: 3, sha: 'abc', summary, plan, hasNews: true });
  assert.ok(fresh.calls.some((c) => c.method === 'POST' && c.url === '/repos/o/r/issues/3/comments'));

  const quiet = fakeGitHub();
  const log = await publish({ gh: quiet.gh, repo: 'o/r', pr: 3, sha: 'abc', summary, plan, hasNews: false });
  assert.deepEqual(log, []);
  assert.ok(!quiet.calls.some((c) => c.method !== 'GET'));

  const old = fakeGitHub({ comments: [{ id: 9, body: `${summary.split('\n')[0]}\nstale` }] });
  await publish({ gh: old.gh, repo: 'o/r', pr: 3, sha: 'abc', summary, plan, hasNews: true });
  assert.ok(old.calls.some((c) => c.method === 'PATCH' && c.url === '/repos/o/r/issues/comments/9'));
  assert.ok(!old.calls.some((c) => c.method === 'POST'));
});

test('publish falls back to one comment at a time when a review is refused', async () => {
  const { gh, calls } = fakeGitHub({ failReview: true });
  const plan = { settle: [], inline: [
    { path: 'a.md', line: 2, body: 'one' },
    { path: 'a.md', line: 99, body: 'two' },
    { path: 'a.md', line: 3, start_line: 2, body: 'three' },
  ] };
  const log = await publish({ gh, repo: 'o/r', pr: 3, sha: 'abc', summary: summaryBody('.', g0, s0), plan, hasNews: true });
  const singles = calls.filter((c) => c.url === '/repos/o/r/pulls/3/comments');
  assert.equal(singles.length, 3);
  assert.deepEqual(singles[2].body, { commit_id: 'abc', path: 'a.md', line: 3, start_line: 2, body: 'three', side: 'RIGHT', start_side: 'RIGHT' });
  assert.ok(log.some((l) => l.startsWith('skipped a.md:99')));
  assert.ok(log.includes('left 2 review comments one at a time'));
});
