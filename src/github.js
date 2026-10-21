// Pull request comments.
//
// `check` decides whether the build passes; this explains it where the
// author is already looking. On a pull request it keeps one summary comment
// up to date: the new strings with no decision, and the rewrites recorded
// in the ledger but not in source, each linked to its line.
//
// Inline comments are opt-in (`--inline`). Then each new string the diff
// touches gets a review comment, and an unapplied rewrite goes up as a
// suggestion block, so it can land from the browser. The next sync sees
// the rewrite in source and records it as the person's words.
//
// No dependencies: Node's fetch and the REST API. A comment is a nicety, so
// every failure here is a warning and never fails the job. That is check's.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { idFor } from './extract/index.js';

const MAX_INLINE = 25;
const MARK = /^<!-- slopchop:(new|settled):([0-9a-f]+):(.+?) -->/;

// ------------------------------------------------------------------ diff ---

/**
 * The right-hand lines a review comment may sit on, from one file's patch:
 * Map<line, hunk index>. Added and context lines both count; GitHub only
 * accepts a multi-line comment when every line is in the same hunk.
 */
export function commentableLines(patch) {
  const lines = new Map();
  if (!patch) return lines;
  let right = 0;
  let hunk = -1;
  for (const l of patch.split('\n')) {
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (h) { right = Number(h[1]); hunk++; continue; }
    if (hunk < 0) continue;
    if (l.startsWith('+') || l.startsWith(' ')) lines.set(right++, hunk);
    // '-' is the left side only; '\' is "no newline at end of file".
  }
  return lines;
}

/** `git diff` output split into { repoPath: patch }. */
export function splitUnifiedDiff(text) {
  const files = {};
  let current = null;
  let buf = [];
  const flush = () => { if (current) files[current] = buf.join('\n'); };
  for (const l of text.split('\n')) {
    if (l.startsWith('diff --git ')) { flush(); current = null; buf = []; continue; }
    if (l.startsWith('+++ ')) { current = l === '+++ /dev/null' ? null : l.slice(4).replace(/^b\//, ''); continue; }
    if (current) buf.push(l);
  }
  flush();
  return files;
}

// --------------------------------------------------------------- content ---

/** A fence longer than any backtick run inside `body`. */
function fenceFor(body) {
  const longest = Math.max(2, ...(body.match(/`+/g) || []).map((r) => r.length));
  return '`'.repeat(longest + 1);
}

const quote = (text) => text.split('\n').map((l) => `> ${l}`).join('\n');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (n, d) => (d === 0 ? '100%' : `${Math.round((n / d) * 100)}%`);

/**
 * The verdict as Markdown lines, shared by the job summary and the pull
 * request comment. `link(file, line)` turns a location into a URL, or null.
 * `inline` says the rewrites were also offered as suggestion blocks.
 */
export function renderVerdict(g, s, { link = () => null, inline = false } = {}) {
  const pending = g.pendingApply || [];
  const where = (o) => {
    const label = `\`${o.file}:${o.line}\``;
    const url = link(o.file, o.line);
    return url ? `[${label}](${url})` : label;
  };
  const cell = (t) => t.replace(/\|/g, '\\|').replace(/\n+/g, ' ').slice(0, 120);

  const L = [];
  if (g.unledgered.length) {
    L.push(`**${plural(g.unledgered.length, 'new string')}** entered the source without a recorded author.`);
    L.push('');
    L.push('| Where | Text |');
    L.push('|---|---|');
    for (const e of g.unledgered.slice(0, 50)) L.push(`| ${where(e.occurrences[0])} | ${cell(e.text)} |`);
    if (g.unledgered.length > 50) L.push(`| … | and ${g.unledgered.length - 50} more |`);
    L.push('');
    L.push('Run `slopchop sync` then `slopchop review` locally, decide each one, and commit the ledger.');
  } else if (!g.unknown?.length && !pending.length) {
    L.push('Everything is settled: every string in source has an author on record, and every rewrite in the ledger is in the source.');
  }
  if (g.unknown?.length) {
    if (g.unledgered.length) L.push('');
    L.push(`**${plural(g.unknown.length, 'string')}** ${g.unknown.length === 1 ? 'has' : 'have'} a status SlopChop does not define, which is not a decision.`);
    L.push('');
    L.push('| Where | Status | Text |');
    L.push('|---|---|---|');
    for (const e of g.unknown.slice(0, 50)) L.push(`| ${where(e.occurrences[0])} | \`${cell(String(e.status))}\` | ${cell(e.text)} |`);
    if (g.unknown.length > 50) L.push(`| … | | and ${g.unknown.length - 50} more |`);
  }
  if (pending.length) {
    if (g.unledgered.length || g.unknown?.length) L.push('');
    L.push(`**${plural(pending.length, 'rewrite')}** ${pending.length === 1 ? 'is' : 'are'} recorded in the ledger and not in the source yet.`);
    L.push('');
    L.push('| Where | Rewrite |');
    L.push('|---|---|');
    for (const e of pending.slice(0, 50)) L.push(`| ${where(e.occurrences[0])} | ${cell(e.replacement || '')} |`);
    if (pending.length > 50) L.push(`| … | and ${pending.length - 50} more |`);
    L.push('');
    L.push(inline
      ? 'Run `slopchop apply --apply` locally and commit the result, or commit the suggestions on those lines.'
      : 'Run `slopchop apply --apply` locally and commit the result.');
  }
  L.push('');
  L.push(`${s.done}/${s.total} strings decided (${pct(s.done, s.total)}) · ${pct(s.byStatus.human, s.total)} written by a person` +
    (g.backlog.length ? ` · ${g.backlog.length} in the grandfathered backlog` : '') +
    (s.excluded?.total ? ` · ${s.excluded.total} marked not copy, not counted` : ''));
  return L;
}

export function summaryBody(key, g, s, opts) {
  return [`<!-- slopchop:summary:${key} -->`, '### SlopChop', '', ...renderVerdict(g, s, opts), ''].join('\n');
}

function newStringBody(entry, repoPath) {
  return [
    `<!-- slopchop:new:${entry.id}:${repoPath} -->`,
    '**New copy with no decision on record.**',
    '',
    quote(entry.text),
    '',
    'Write your own version in `slopchop review`, or mark it as fine the way it is, then commit the ledger.',
  ].join('\n');
}

function settledBody(id, repoPath, text, gone) {
  return [
    `<!-- slopchop:settled:${id}:${repoPath} -->`,
    `~~New copy with no decision on record.~~ ${gone ? 'No longer in the source.' : 'Decided in the ledger.'}`,
    ...(text ? ['', quote(text)] : []),
  ].join('\n');
}

function suggestionBody(change) {
  const after = change.after.replace(/\r$/gm, '');
  const fence = fenceFor(after);
  return [
    // The text is in the marker, so a rewrite edited later is offered again.
    `<!-- slopchop:rewrite:${change.ids.join(',')}:${idFor(after)} -->`,
    change.model
      ? "A model's rewrite you accepted, not applied yet. Committing this suggestion puts it in the source, and the next `slopchop sync` records it as ai-revised."
      : 'Your rewrite from the ledger, not applied yet. Committing this suggestion puts it in the source, and the next `slopchop sync` records it as yours.',
    '',
    `${fence}suggestion`,
    after,
    fence,
  ].join('\n');
}

// ------------------------------------------------------------------ plan ---

/**
 * Which review comments to leave. `diff` maps repo paths to their
 * commentable lines; `prefix` turns a ledger path into a repo path.
 * `existing` is the review comments already on the pull request.
 */
export function planComments({ unledgered, changes, diff, entries = [], prefix = '', existing = [] }) {
  const repoPath = (file) => (prefix ? `${prefix}/${file}` : file);
  const seen = new Map();   // `${id}:${path}` -> existing comment
  const posted = new Set(existing.map((c) => c.body?.split('\n')[0]));
  for (const c of existing) {
    const m = MARK.exec(c.body || '');
    if (m) seen.set(`${m[2]}:${m[3]}`, { ...c, state: m[1], entryId: m[2], path: m[3] });
  }

  const inline = [];
  const outsideDiff = [];

  for (const e of unledgered) {
    // One comment per file is plenty, on the first occurrence the diff shows.
    const files = new Map();
    for (const o of e.occurrences) {
      const rp = repoPath(o.file);
      if (diff.get(rp)?.has(o.line) && !files.has(rp)) files.set(rp, o);
    }
    if (!files.size) { outsideDiff.push(e); continue; }
    for (const [rp, o] of files) {
      if (seen.has(`${e.id}:${rp}`)) continue;
      inline.push({ path: rp, line: o.line, body: newStringBody(e, rp) });
    }
  }

  for (const ch of changes) {
    const rp = repoPath(ch.file);
    const lines = diff.get(rp);
    if (!lines) continue;
    const hunk = lines.get(ch.startLine);
    let fits = hunk !== undefined;
    for (let l = ch.startLine; fits && l <= ch.endLine; l++) fits = lines.get(l) === hunk;
    if (!fits) continue;
    const body = suggestionBody(ch);
    if (posted.has(body.split('\n')[0])) continue;
    inline.push({
      path: rp,
      line: ch.endLine,
      ...(ch.endLine > ch.startLine ? { start_line: ch.startLine } : {}),
      body,
    });
  }

  // A string that was new and has since been decided: say so on its thread
  // rather than leaving a comment that still reads as an open question.
  const open = new Set(unledgered.flatMap((e) => e.occurrences.map((o) => `${e.id}:${repoPath(o.file)}`)));
  const present = new Set(entries.map((e) => e.id));
  const settle = [...seen.entries()]
    .filter(([key, c]) => c.state === 'new' && !open.has(key))
    .map(([, c]) => {
      const text = (c.body.match(/^> .*$/gm) || []).map((l) => l.slice(2)).join('\n');
      return { id: c.id, body: settledBody(c.entryId, c.path, text, !present.has(c.entryId)) };
    });

  return { inline: inline.slice(0, MAX_INLINE), dropped: Math.max(0, inline.length - MAX_INLINE), outsideDiff, settle };
}

// ------------------------------------------------------------------- api ---

export function apiClient({ token, api = 'https://api.github.com', fetchImpl = globalThis.fetch }) {
  async function call(method, url, body) {
    const res = await fetchImpl(url.startsWith('http') ? url : `${api}${url}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'slopchop',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(`${method} ${url} → ${res.status} ${(await res.text()).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  call.all = async (url) => {
    const out = [];
    for (let page = 1; page <= 30; page++) {
      const batch = await call('GET', `${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  };
  return call;
}

/**
 * Bring the pull request up to date. Returns a log of what happened, for
 * the caller to print; throws only on a failure before anything was posted.
 */
export async function publish({ gh, repo, pr, sha, key, summary, plan, hasNews }) {
  const log = [];
  const base = `/repos/${repo}`;

  const marker = summary.split('\n')[0];
  const comments = await gh.all(`${base}/issues/${pr}/comments`);
  const mine = comments.find((c) => (c.body || '').startsWith(marker));
  if (mine) {
    if (mine.body !== summary) { await gh('PATCH', `${base}/issues/comments/${mine.id}`, { body: summary }); log.push('updated the summary comment'); }
  } else if (hasNews) {
    await gh('POST', `${base}/issues/${pr}/comments`, { body: summary });
    log.push('posted a summary comment');
  }

  for (const s of plan.settle) {
    await gh('PATCH', `${base}/pulls/comments/${s.id}`, { body: s.body });
  }
  if (plan.settle.length) log.push(`marked ${plural(plan.settle.length, 'comment')} settled`);

  if (!plan.inline.length) return log;
  const asReview = plan.inline.map((c) => ({
    ...c, side: 'RIGHT', ...(c.start_line ? { start_side: 'RIGHT' } : {}),
  }));
  try {
    await gh('POST', `${base}/pulls/${pr}/reviews`, { commit_id: sha, event: 'COMMENT', comments: asReview });
    log.push(`left ${plural(asReview.length, 'review comment')}${key ? ` (${key})` : ''}`);
  } catch (e) {
    if (e.status !== 422) throw e;
    // One bad anchor sinks a whole review. Post them one at a time instead
    // and keep the ones GitHub accepts.
    let ok = 0;
    for (const c of asReview) {
      try { await gh('POST', `${base}/pulls/${pr}/comments`, { commit_id: sha, ...c }); ok++; }
      catch (err) { log.push(`skipped ${c.path}:${c.line}: ${err.message}`); }
    }
    log.push(`left ${plural(ok, 'review comment')} one at a time`);
  }
  return log;
}

// ------------------------------------------------------------- locations ---

/** The project root relative to the repository root, posix, '' at the top. */
export function repoPrefix(root) {
  let top = null;
  try {
    top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { top = process.env.GITHUB_WORKSPACE || root; }
  const rel = path.relative(path.resolve(top), path.resolve(root));
  return rel.split(path.sep).join('/');
}

/** Commentable lines per repo path, from `git diff` against `base`. */
export function localDiff(root, base) {
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  const files = splitUnifiedDiff(git('diff', '--no-color', '--no-ext-diff', '-U3', mergeBase, '--'));
  return new Map(Object.entries(files).map(([f, p]) => [f, commentableLines(p)]));
}

/** Commentable lines per repo path, from the pull request's file list. */
export async function pullDiff(gh, repo, pr) {
  const files = await gh.all(`/repos/${repo}/pulls/${pr}/files`);
  return new Map(files.map((f) => [f.filename, commentableLines(f.patch)]));
}

/** The pull request this workflow run is for, from the event payload. */
export function pullFromEvent(eventPath = process.env.GITHUB_EVENT_PATH) {
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  const ev = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pr = ev.pull_request;
  return pr ? { number: pr.number, sha: pr.head.sha } : null;
}
