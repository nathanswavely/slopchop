// slopchop CLI.
//
//   init      write a starter .slopchop.json for this repo
//   sync      re-extract from source, preserving every review decision
//   stats     progress, by tier and by file
//   review    open the local review UI
//   draft     write the queue out as Markdown, to edit anywhere
//   pull      read edited drafts back into the ledger
//   decide    bulk-decide a file or tier
//   apply     write approved replacements into source (dry run by default)
//   check     CI gate: fails on copy that entered source unreviewed
//   comment   explain the gate on a pull request, with rewrites as suggestions
//   report    render the ledger as a publishable summary, plus a badge

import fs from 'node:fs';
import path from 'node:path';
import { loadProject, proposeConfig, CONFIG_NAME } from './config.js';
import { load, save, sync, stats, gate, STATUSES } from './ledger.js';
import { writeback, previewLines } from './writeback.js';
import { writeReport } from './report.js';
import {
  renderVerdict, summaryBody, planComments, publish, apiClient,
  repoPrefix, localDiff, pullDiff, pullFromEvent,
} from './github.js';
import {
  writeDrafts, pullDrafts, pruneDrafts, outstandingDrafts, rescueOrphans, draftDirLabel,
} from './drafts.js';

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--'));
const flag = (name) => argv.includes(`--${name}`);
const val = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};

const TTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (TTY ? code : '');
const GREEN = c('\x1b[32m'); const RED = c('\x1b[31m');
const YEL = c('\x1b[33m'); const DIM = c('\x1b[2m'); const OFF = c('\x1b[0m');

function pct(n, d) { return d === 0 ? '100%' : `${Math.round((n / d) * 100)}%`; }

function bar(done, total, width = 28) {
  const filled = total === 0 ? width : Math.round((done / total) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

function project() {
  try {
    return loadProject({ configPath: val('config') });
  } catch (e) {
    console.error(`${RED}${e.message}${OFF}`);
    process.exit(2);
  }
}

// ------------------------------------------------------------------ init ---

function cmdInit() {
  const root = path.resolve(val('config') ? path.dirname(val('config')) : '.');
  const target = val('config') ? path.resolve(val('config')) : path.join(root, CONFIG_NAME);
  if (fs.existsSync(target) && !flag('force')) {
    console.error(`${YEL}${path.relative(process.cwd(), target) || target} already exists.${OFF} Pass --force to overwrite.`);
    process.exit(1);
  }
  const { config, matched } = proposeConfig(root);
  if (!matched.length) {
    config.include = ['README.md'];
    console.log(`${YEL}No familiar copy-bearing files found.${OFF} Starting with README.md; edit "include" to suit.`);
  } else {
    console.log('Found copy in:');
    for (const m of matched) console.log(`  ${m.include.padEnd(64)} ${DIM}${m.files} file${m.files === 1 ? '' : 's'}${m.why ? ` · ${m.why}` : ''}${OFF}`);
  }
  fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
  console.log(`\n${GREEN}wrote${OFF} ${path.relative(process.cwd(), target) || target}`);
  console.log(`\nNext:\n  ${GREEN}slopchop sync${OFF}     ${DIM}# build the ledger and stamp the baseline${OFF}`);
  console.log(`  ${GREEN}slopchop review${OFF}   ${DIM}# start deciding${OFF}`);
  console.log(`  ${GREEN}slopchop check${OFF}    ${DIM}# the CI gate${OFF}`);
}

// ------------------------------------------------------------------ sync ---

function cmdSync() {
  const p = project();
  const before = load(p);
  const { ledger, added, removed, landed } = sync(p, before);

  if (flag('rebaseline') || !before.baseline) {
    ledger.baseline = ledger.entries
      .filter((e) => e.status === 'unreviewed').map((e) => e.id);
    console.log(`${YEL}baseline stamped:${OFF} ${ledger.baseline.length} strings accepted as existing debt.`);
    console.log(`${DIM}New copy added after this point must be reviewed before CI passes.${OFF}`);
  } else {
    ledger.baseline = before.baseline;
  }

  save(p, ledger);
  const s = stats(ledger);
  console.log(`${GREEN}synced${OFF} ${p.rel(p.ledgerPath)}: ${s.total} entries, ${s.words.toLocaleString()} words, ${p.sourceFiles().length} files`);
  if (added.length) console.log(`  ${added.length} new`);
  if (landed.length) console.log(`  ${landed.length} rewrite${landed.length === 1 ? '' : 's'} found in source without apply, recorded as yours`);
  const gone = removed.filter((e) => !landed.includes(e));
  if (gone.length) console.log(`  ${gone.length} no longer in source`);
}

// ----------------------------------------------------------------- stats ---

function cmdStats() {
  const p = project();
  const ledger = load(p);
  const s = stats(ledger);

  console.log(`\n  ${bar(s.done, s.total)}  ${s.done}/${s.total} strings (${pct(s.done, s.total)})`);
  console.log(`  ${DIM}${s.wordsDone.toLocaleString()} of ${s.words.toLocaleString()} words decided · ${pct(s.byStatus.human, s.total)} written by a person${OFF}\n`);

  for (const tier of ['prose', 'helper', 'label']) {
    const t = s.byTier[tier];
    const name = { prose: 'paragraphs (16+ words)', helper: 'helper text (6–15)', label: 'labels (1–5)' }[tier];
    console.log(`  ${name.padEnd(24)} ${bar(t.done, t.total, 18)} ${String(t.done).padStart(4)}/${t.total}`);
  }

  console.log('');
  for (const st of STATUSES) {
    if (!s.byStatus[st]) continue;
    console.log(`  ${st.padEnd(12)} ${s.byStatus[st]}`);
  }

  const byFile = new Map();
  for (const e of ledger.entries) {
    if (e.status !== 'unreviewed') continue;
    for (const o of e.occurrences) byFile.set(o.file, (byFile.get(o.file) || 0) + e.words);
  }
  const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) {
    console.log(`\n  ${DIM}most unreviewed words:${OFF}`);
    for (const [file, words] of top) console.log(`    ${String(words).padStart(5)}  ${file}`);
  }

  reportOutstanding(p, ledger, '  ');
  console.log('');
}

function reportOutstanding(p, ledger, pad = '') {
  const drafts = outstandingDrafts(p, ledger);
  if (!drafts.length) return drafts;

  console.log(`\n${pad}${YEL}checked out as drafts${OFF} ${DIM}(${draftDirLabel(p)})${OFF}`);
  for (const d of drafts) {
    const notes = [];
    if (d.dirty.length) notes.push(`${d.dirty.length} written, not pulled`);
    if (d.stale.length) notes.push(`${RED}${d.stale.length} stale${OFF}`);
    if (d.orphanedWriting.length) notes.push(`${RED}${d.orphanedWriting.length} holding writing${OFF}`);
    const rest = d.blocks - d.dirty.length - d.stale.length;
    if (rest) notes.push(`${DIM}${rest} untouched${OFF}`);
    console.log(`${pad}  ${d.source} ${DIM}·${OFF} ${notes.join(` ${DIM}·${OFF} `)}`);
  }

  const stale = drafts.filter((d) => d.stale.length);
  if (stale.length) {
    console.log(`\n${pad}${DIM}A stale marker names a string the source no longer has. ${OFF}${GREEN}slopchop pull --redraft${OFF}${DIM} re-cuts those files.${OFF}`);
  } else {
    console.log(`\n${pad}${DIM}Decide these files in the drafts, not in the review UI.${OFF}`);
  }
  return drafts;
}

// ------------------------------------------------------------ draft/pull ---

function cmdDraft() {
  const p = project();
  const ledger = load(p);
  const r = writeDrafts(p, ledger, { file: val('file'), tier: val('tier'), force: flag('force') });

  if (r.skippedDirty.length) {
    console.log(`${YEL}skipped: these drafts hold writing that isn't recorded yet:${OFF}`);
    for (const f of r.skippedDirty) console.log(`  ${draftDirLabel(p)}/${f}.md`);
    console.log(`${DIM}Run slopchop pull first, or pass --force to overwrite.${OFF}\n`);
  }
  if (!r.files.length) {
    if (!r.skippedDirty.length) console.log('Nothing left to draft.');
    return;
  }
  for (const f of r.files) console.log(`  ${f}`);
  console.log(`\n${GREEN}${r.files.length} file${r.files.length === 1 ? '' : 's'}${OFF} · ${r.entries} strings.`);
  console.log(`${DIM}Edit them anywhere, then: slopchop pull${OFF}`);
}

function cmdPull() {
  const p = project();
  const ledger = load(p);
  const r = pullDrafts(p, ledger);

  if (!r.files) { console.log('No drafts. Run slopchop draft first.'); return; }

  save(p, ledger);
  const bits = [];
  if (r.recorded) bits.push(`${r.recorded} rewritten`);
  if (r.mine) bits.push(`${r.mine} marked yours`);
  if (r.fine) bits.push(`${r.fine} left as drafted`);
  console.log(bits.length ? `${GREEN}${bits.join(' · ')}${OFF}` : 'No changes found in the drafts.');
  if (r.unchanged) console.log(`${DIM}${r.unchanged} untouched${OFF}`);

  const { removed, kept } = pruneDrafts(p, load(p));
  if (removed.length) console.log(`${DIM}cleared ${removed.length} finished draft file(s)${OFF}`);

  if (r.unknown.length) reportStale(p, r, kept);
  if (r.recorded) console.log(`\nNext: ${GREEN}slopchop apply${OFF} (dry run), then ${GREEN}--apply${OFF}.`);
}

function reportStale(p, r, kept) {
  const files = [...new Set(r.unknown.map((u) => u.file))];
  const landed = r.unknown.filter((u) => u.landed);
  const written = r.unknown.filter((u) => u.touched !== false && !u.landed);

  console.log(`\n${YEL}${r.unknown.length} marker${r.unknown.length === 1 ? '' : 's'} matched no ledger entry${OFF}`);
  console.log(`${DIM}in ${files.join(', ')}: the source changed under the draft.${OFF}`);
  if (landed.length) console.log(`${DIM}${landed.length} of them already landed in source. Nothing owed there.${OFF}`);
  if (written.length) console.log(`${RED}${written.length} of them hold writing${OFF} ${DIM}that has no entry left to land on.${OFF}`);
  if (kept.length) console.log(`${DIM}kept ${kept.length} draft file(s) that would otherwise have been cleared.${OFF}`);

  if (!flag('redraft')) {
    console.log(`\nRe-cut those files against the current source:`);
    console.log(`  ${GREEN}slopchop pull --redraft${OFF}   ${DIM}# sync, save any orphaned writing, re-draft${OFF}`);
    return;
  }

  const { ledger: fresh } = sync(p, load(p));
  fresh.baseline = load(p).baseline;
  save(p, fresh);

  const rescued = rescueOrphans(p, fresh, files);
  for (const f of rescued) console.log(`\n${YEL}saved orphaned writing →${OFF} ${f}`);

  const before = outstandingDrafts(p, fresh).filter((d) => files.includes(d.source));
  const out = [];
  for (const file of files) out.push(...writeDrafts(p, load(p), { file, force: true }).files);

  if (out.length) {
    console.log(`\n${GREEN}re-drafted${OFF} ${out.length} file${out.length === 1 ? '' : 's'}:`);
    for (const f of out) console.log(`  ${f}`);
  }

  for (const d of before) {
    if (out.includes(d.rel)) continue;
    if (!fs.existsSync(d.path)) continue;
    fs.unlinkSync(d.path);
    console.log(`${DIM}cleared ${d.rel}: nothing in it is still waiting on a decision${OFF}`);
  }
}

// ---------------------------------------------------------------- decide ---

// Bulk decisions, for when a whole file's copy has one answer. It only ever
// moves entries OUT of `unreviewed` unless --force, so re-running can't
// quietly undo work done string-by-string in the UI.
function cmdDecide() {
  const p = project();
  const status = val('status');
  const file = val('file');
  const tier = val('tier');
  const note = val('note');
  const maxWords = val('max-words') ? Number(val('max-words')) : null;
  if (maxWords !== null && !Number.isInteger(maxWords)) {
    console.error('--max-words takes a whole number');
    process.exit(1);
  }
  if (!STATUSES.includes(status)) {
    console.error(`--status must be one of: ${STATUSES.join(', ')}`);
    process.exit(1);
  }
  if (!file && !tier && maxWords === null) {
    console.error('refusing to touch every entry. Pass --file, --tier and/or --max-words');
    process.exit(1);
  }

  const ledger = load(p);
  const hit = ledger.entries.filter((e) =>
    (!file || e.occurrences.some((o) => o.file === file)) &&
    (!tier || e.tier === tier) &&
    (maxWords === null || e.words < maxWords) &&
    (flag('force') || e.status === 'unreviewed'));

  if (!hit.length) { console.log('Nothing matched.'); return; }

  console.log(`${hit.length} entries · ${hit.reduce((n, e) => n + e.words, 0).toLocaleString()} words → ${status}`);
  for (const e of hit.slice(0, 8)) console.log(`  ${DIM}${e.text.slice(0, 76)}${OFF}`);
  if (hit.length > 8) console.log(`  ${DIM}…and ${hit.length - 8} more${OFF}`);

  if (!flag('apply')) {
    console.log(`\n${YEL}dry run${OFF}. Re-run with ${GREEN}--apply${OFF} to record.`);
    return;
  }
  for (const e of hit) { e.status = status; if (note) e.note = note; }
  save(p, ledger);
  console.log(`\n${GREEN}recorded.${OFF}`);
}

// ----------------------------------------------------------------- apply ---

function cmdApply() {
  const p = project();
  const ledger = load(p);
  const apply = flag('apply');
  const r = writeback(p, ledger, { apply });

  if (!r.entries && !r.blocked.length) {
    console.log('Nothing to apply. Save a rewrite in the review UI or a draft first.');
    return;
  }

  for (const f of r.files) console.log(`  ${f.file} ${DIM}(${f.edits} occurrence${f.edits === 1 ? '' : 's'})${OFF}`);

  if (r.blocked.length) {
    console.log(`\n${RED}blocked: ${r.blocked.length} entr${r.blocked.length === 1 ? 'y' : 'ies'} not applied:${OFF}`);
    for (const b of r.blocked) {
      console.log(`  ${DIM}${b.entry.occurrences[0].file}:${b.entry.occurrences[0].line}${OFF}`);
      console.log(`    "${b.entry.text.slice(0, 70)}${b.entry.text.length > 70 ? '…' : ''}"`);
      console.log(`    ${RED}${b.reason}${OFF}`);
    }
  }

  if (apply) {
    save(p, ledger);
    console.log(`\n${GREEN}applied${OFF} ${r.entries} entries across ${r.occurrences} occurrences.`);
    console.log(`${DIM}Ledger updated: replaced drafts kept as previous_ai_text.${OFF}`);
    console.log(`${DIM}Review the diff before committing. Writeback edits source.${OFF}`);
  } else {
    console.log(`\n${YEL}dry run${OFF}: ${r.entries} entries / ${r.occurrences} occurrences would change.`);
    console.log(`Re-run with ${GREEN}--apply${OFF} to write.`);
  }
}

// ----------------------------------------------------------------- check ---

function cmdCheck() {
  const p = project();
  if (!fs.existsSync(p.ledgerPath)) {
    console.error(`${RED}no ledger${OFF} at ${p.rel(p.ledgerPath)}. Run: slopchop sync`);
    process.exit(1);
  }

  const onDisk = load(p);
  const { ledger: fresh } = sync(p, onDisk);
  const g = gate(onDisk, fresh);
  const s = stats(fresh);

  const ok = !g.unledgered.length && !(g.strict && g.backlog.length);

  // Machine-readable: the JSON is the whole of stdout, nothing else.
  if (flag('json')) {
    console.log(JSON.stringify({
      ok,
      unledgered: g.unledgered.map((e) => ({ id: e.id, text: e.text, file: e.occurrences[0].file, line: e.occurrences[0].line })),
      backlog: g.backlog.length, pendingApply: g.pendingApply.length, strict: g.strict, stats: s,
    }, null, 2));
    writeSummary(p, g, s);
    process.exit(ok ? 0 : 1);
  }

  if (g.backlog.length) {
    console.log(`${DIM}backlog: ${g.backlog.length} strings still unreviewed from baseline (not a failure)${OFF}`);
  }
  if (g.pendingApply.length) {
    console.log(`${YEL}${g.pendingApply.length} rewritten but not applied.${OFF} Run: slopchop apply`);
  }

  writeSummary(p, g, s);

  if (g.strict && g.backlog.length) {
    console.error(`\n${RED}strict mode: ${g.backlog.length} strings still unreviewed.${OFF}`);
    process.exit(1);
  }

  if (!g.unledgered.length) {
    console.log(`${GREEN}✓${OFF} every string in source has an author on record.`);
    return;
  }

  console.error(`\n${RED}✗ ${g.unledgered.length} new string${g.unledgered.length === 1 ? '' : 's'} entered source without a review decision:${OFF}\n`);
  for (const e of g.unledgered.slice(0, 25)) {
    const o = e.occurrences[0];
    console.error(`  ${o.file}:${o.line}`);
    console.error(`    "${e.text.slice(0, 88)}${e.text.length > 88 ? '…' : ''}"`);
  }
  if (g.unledgered.length > 25) console.error(`  ${DIM}…and ${g.unledgered.length - 25} more${OFF}`);

  console.error(`\n  Decide each one, then commit the ledger:`);
  console.error(`    slopchop sync       ${DIM}# fold the new strings into the ledger${OFF}`);
  console.error(`    slopchop review     ${DIM}# write your own version, or mark it as-is${OFF}`);
  console.error(`    slopchop apply      ${DIM}# write approved text into source${OFF}\n`);
  process.exit(1);
}

// On GitHub Actions, the same verdict lands in the job summary, where a
// reviewer sees it without opening the log.
function writeSummary(p, g, s) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  const L = ['## SlopChop', '', ...renderVerdict(g, s), ''];
  try { fs.appendFileSync(target, L.join('\n')); } catch { /* a summary is a nicety */ }
}

// --------------------------------------------------------------- comment ---

// The gate's verdict, said on the pull request. Never fails the job: a
// fork's read-only token or a GitHub hiccup costs a comment, not a build.
async function cmdComment() {
  const p = project();
  if (!fs.existsSync(p.ledgerPath)) {
    console.error(`${RED}no ledger${OFF} at ${p.rel(p.ledgerPath)}. Run: slopchop sync`);
    process.exit(1);
  }
  const onDisk = load(p);
  const { ledger: fresh } = sync(p, onDisk);
  const g = gate(onDisk, fresh);
  const s = stats(fresh);
  const { changes } = previewLines(p, fresh);
  const prefix = repoPrefix(p.root);
  const key = prefix || '.';
  const warn = (m) => console.log(process.env.GITHUB_ACTIONS ? `::warning title=SlopChop::${m}` : `${YEL}${m}${OFF}`);

  // Local preview: the same plan against `git diff`, printed, nothing sent.
  const base = val('base');
  if (base) {
    let diff;
    try { diff = localDiff(p.root, base); }
    catch (e) { console.error(`${RED}git diff against ${base} failed:${OFF} ${e.message}`); process.exit(1); }
    const plan = planComments({ unledgered: g.unledgered, changes, diff, entries: fresh.entries, prefix });
    console.log(summaryBody(key, g, s, { pending: g.pendingApply }));
    for (const c of plan.inline) {
      console.log(`${DIM}──${OFF} ${GREEN}${c.path}:${c.start_line ? `${c.start_line}-` : ''}${c.line}${OFF}`);
      console.log(c.body.split('\n').slice(1).join('\n'));
    }
    if (plan.dropped) console.log(`${DIM}…and ${plan.dropped} more not posted this run${OFF}`);
    if (plan.outsideDiff.length) console.log(`${DIM}${plan.outsideDiff.length} new string(s) sit outside the diff; the summary lists them.${OFF}`);
    return;
  }

  const pr = pullFromEvent();
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!pr || !token || !repo) {
    console.error('Not a pull request run. Pass --base <ref> to preview the comments locally.');
    console.error(`${DIM}On GitHub Actions this needs GITHUB_TOKEN, GITHUB_REPOSITORY and a pull_request event.${OFF}`);
    process.exit(process.env.GITHUB_ACTIONS ? 0 : 1);
  }

  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const link = (file, line) => `${server}/${repo}/blob/${pr.sha}/${prefix ? `${prefix}/` : ''}${file}#L${line}`;
  const gh = apiClient({ token, api: process.env.GITHUB_API_URL || 'https://api.github.com' });

  try {
    const diff = await pullDiff(gh, repo, pr.number);
    const existing = await gh.all(`/repos/${repo}/pulls/${pr.number}/comments`);
    const plan = planComments({ unledgered: g.unledgered, changes, diff, entries: fresh.entries, prefix, existing });
    const summary = summaryBody(key, g, s, { link, pending: g.pendingApply });
    const hasNews = g.unledgered.length > 0 || plan.inline.length > 0;
    const log = await publish({ gh, repo, pr: pr.number, sha: pr.sha, key: prefix, summary, plan, hasNews });
    for (const line of log) console.log(line);
    if (!log.length) console.log('Nothing new to say on this pull request.');
    if (plan.dropped) console.log(`${plan.dropped} more held back; they go up as earlier ones are settled.`);
  } catch (e) {
    if (e.status === 403 || e.status === 404) {
      warn('Could not comment on this pull request. A fork\'s token is read-only; elsewhere, grant the job `pull-requests: write`.');
    } else {
      warn(`Commenting failed: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------- report ---

function cmdReport() {
  const p = project();
  const out = writeReport(p, load(p));
  console.log(`${GREEN}wrote${OFF} ${p.rel(out.report)}`);
  console.log(`${GREEN}wrote${OFF} ${p.rel(out.badge)} ${DIM}(shields.io endpoint)${OFF}`);
  console.log(`${GREEN}wrote${OFF} ${p.rel(out.svg)}`);
}

// ---------------------------------------------------------------- review ---

async function cmdReview() {
  const { serve } = await import('./serve.js');
  serve(project());
}

// ------------------------------------------------------------------------ ---

const COMMANDS = {
  init: cmdInit, sync: cmdSync, stats: cmdStats, apply: cmdApply, check: cmdCheck,
  report: cmdReport, decide: cmdDecide, draft: cmdDraft, pull: cmdPull, review: cmdReview,
  comment: cmdComment,
};

if (!COMMANDS[cmd]) {
  console.error(`usage: slopchop <${Object.keys(COMMANDS).join('|')}> [--config path]`);
  process.exit(cmd ? 1 : 0);
}
await COMMANDS[cmd]();
