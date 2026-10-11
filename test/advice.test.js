// Triage, suggestions, and the line between a person's words and a model's.

import assert from 'node:assert/strict';
import test from 'node:test';
import { askJson, pool } from '../src/claude.js';
import { select, batches, triage, suggest, suggestionProblem } from '../src/advice.js';
import { sync, load, save, decide, merge, stats, promote, gate } from '../src/ledger.js';
import { writeback } from '../src/writeback.js';
import { idFor } from '../src/extract/index.js';
import { withProject, read } from './helpers.js';

// ---------------------------------------------------------------- client ---

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses.shift();
    return {
      ok: r.status === 200,
      status: r.status,
      headers: { get: (h) => (r.headers || {})[h] ?? null },
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  };
  return { fetchImpl, calls };
}

const message = (data, over = {}) => ({
  status: 200,
  body: { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(data) }], usage: {}, ...over },
});
const env = { ANTHROPIC_API_KEY: 'sk-test' };
const schema = { type: 'object', properties: {}, additionalProperties: false };

test('a request asks for JSON, names the effort, and opts into fallbacks', async () => {
  const { fetchImpl, calls } = fakeFetch([message({ items: [] })]);
  const r = await askJson({ system: 'S', user: 'U', schema, env, fetchImpl });
  assert.deepEqual(r.data, { items: [] });
  const { url, init, body } = calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], 'sk-test');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  assert.equal(init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.fallbacks, 'default');
  assert.deepEqual(body.output_config, { effort: 'medium', format: { type: 'json_schema', schema } });
  assert.equal(body.thinking, undefined);
  assert.equal(body.system[0].text, 'S');
});

test('a model without server-side fallbacks gets none', async () => {
  const { fetchImpl, calls } = fakeFetch([message({})]);
  await askJson({ system: 'S', user: 'U', schema, env, fetchImpl, model: 'claude-haiku-4-5' });
  assert.equal(calls[0].init.headers['anthropic-beta'], undefined);
  assert.equal(calls[0].body.fallbacks, undefined);
});

test('overloads are retried, honouring retry-after; a bad key is not', async () => {
  const slept = [];
  const sleep = async (ms) => { slept.push(ms); };
  const { fetchImpl, calls } = fakeFetch([
    { status: 529, body: { error: { message: 'Overloaded' } }, headers: { 'retry-after': '2' } },
    message({ ok: true }),
  ]);
  const r = await askJson({ system: 'S', user: 'U', schema, env, fetchImpl, sleep });
  assert.deepEqual(r.data, { ok: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(slept, [2000]);

  const bad = fakeFetch([{ status: 401, body: { error: { message: 'invalid x-api-key' } } }]);
  await assert.rejects(askJson({ system: 'S', user: 'U', schema, env, fetchImpl: bad.fetchImpl, sleep }),
    /401: invalid x-api-key\. Check ANTHROPIC_API_KEY/);
  assert.equal(bad.calls.length, 1);
});

test('a refusal, a cut-off, and a missing key are errors, not empty answers', async () => {
  const refused = fakeFetch([message({}, { stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] })]);
  await assert.rejects(askJson({ system: 'S', user: 'U', schema, env, fetchImpl: refused.fetchImpl }), /declined this batch \(cyber\)/);
  const cut = fakeFetch([message({}, { stop_reason: 'max_tokens' })]);
  await assert.rejects(askJson({ system: 'S', user: 'U', schema, env, fetchImpl: cut.fetchImpl }), /cut off/);
  await assert.rejects(askJson({ system: 'S', user: 'U', schema, env: {} }), /ANTHROPIC_API_KEY/);
});

test('pool keeps order and reports failures in place', async () => {
  const r = await pool([1, 2, 3, 4], 2, async (n) => { if (n === 3) throw new Error('no'); return n * 10; });
  assert.deepEqual(r.map((x) => (x.ok ? x.value : x.error.message)), [10, 20, 'no', 40]);
});

// ------------------------------------------------------------- selection ---

const entry = (text, over = {}) => ({
  id: idFor(text), text, words: text.split(/\s+/).length,
  tier: text.split(/\s+/).length >= 16 ? 'prose' : text.split(/\s+/).length >= 6 ? 'helper' : 'label',
  status: 'unreviewed', replacement: null, note: null,
  occurrences: [{ file: 'a.md', line: 1, kind: 'md-block', raw: text }], ...over,
});

test('triage skips labels and anything already answered; suggest waits for triage', () => {
  const para = entry('We leverage cutting-edge tooling to deliver seamless experiences for every single customer who walks through our doors.');
  const helper = entry('Save your changes before you leave.');
  const label = entry('Save');
  const done = entry('Already decided helper text here.', { status: 'human' });
  const ledger = { entries: [label, helper, para, done] };

  assert.deepEqual(select(ledger, 'triage').map((e) => e.text), [para.text, helper.text]);
  assert.deepEqual(select(ledger, 'triage', { tier: 'label' }).map((e) => e.text), ['Save']);

  assert.equal(select(ledger, 'suggest').length, 0);
  para.triage = { verdict: 'rewrite', tells: [] };
  helper.triage = { verdict: 'fine', tells: [] };
  assert.deepEqual(select(ledger, 'suggest').map((e) => e.id), [para.id]);
  assert.deepEqual(select(ledger, 'suggest', { id: helper.id }).map((e) => e.id), [helper.id]);
  assert.equal(select(ledger, 'triage').length, 0);
  assert.equal(select(ledger, 'triage', { redo: true }).length, 2);
});

test('batches fill by count or by words, whichever comes first', () => {
  const es = [10, 10, 10, 30, 5].map((w, i) => ({ id: String(i), words: w }));
  assert.deepEqual(batches(es, { size: 2, words: 100 }).map((b) => b.length), [2, 2, 1]);
  assert.deepEqual(batches(es, { size: 10, words: 25 }).map((b) => b.length), [2, 1, 1, 1]);
});

// ------------------------------------------------------------------- runs ---

const project = { config: {}, abs: (p) => p, rel: (p) => p, configPath: '.slopchop.json' };

test('triage records verdicts, keeps only tells the string really contains', async () => {
  const a = entry('We leverage cutting-edge tooling to deliver seamless experiences for every customer.');
  const b = entry('Could not load your comments.');
  const ask = async ({ user, schema }) => {
    assert.ok(schema.properties.items);
    assert.match(user, /cutting-edge/);
    return {
      model: 'claude-opus-5-5',
      data: { items: [
        { id: a.id, verdict: 'rewrite', note: 'Say what you build.', tells: [
          { quote: 'Cutting-Edge tooling', why: 'stock phrase' },
          { quote: 'synergy', why: 'not in the string' },
        ] },
        { id: b.id, verdict: 'fine', note: '', tells: [] },
        { id: 'nope', verdict: 'rewrite', note: '', tells: [] },
      ] },
    };
  };
  const batchesDone = [];
  const r = await triage(project, [a, b], { ask, onBatch: () => batchesDone.push(1) });
  assert.deepEqual([r.rewrite, r.fine, r.failed.length], [1, 1, 0]);
  assert.equal(batchesDone.length, 1);
  assert.equal(a.triage.verdict, 'rewrite');
  assert.deepEqual(a.triage.tells, [{ quote: 'cutting-edge tooling', why: 'stock phrase' }]);
  assert.equal(a.triage.note, 'Say what you build.');
  assert.equal(b.triage.note, undefined);
});

test('a batch that fails leaves its strings untouched and says why', async () => {
  const a = entry('One string that will not get an answer back.');
  const r = await triage(project, [a], { ask: async () => { throw new Error('API 500: boom'); } });
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].reason, 'API 500: boom');
  assert.equal(a.triage, undefined);
});

test('a suggestion that would break the file or drop a placeholder is not kept', async () => {
  assert.equal(suggestionProblem(entry('Hello {name}, welcome back.'), 'Hi there, welcome back.'), 'drops the placeholder {name}');
  const attr = entry('Search the docs', { occurrences: [{ file: 'a.html', line: 1, kind: 'attr:placeholder', quote: '"', raw: 'Search the docs' }] });
  assert.match(suggestionProblem(attr, 'Search "the" docs'), /closes the attribute/);
  assert.equal(suggestionProblem(attr, 'Look something up'), null);

  const a = entry('Hello {name}, we are thrilled to have you on this incredible journey with us.');
  const b = entry('Our robust platform empowers teams to unlock their potential.');
  const c = entry('This one is already fine as it is.');
  const ask = async () => ({ model: 'm', data: { items: [
    { id: a.id, text: 'Hi, glad you are here.', why: 'cut the hype' },
    { id: b.id, text: 'Teams use this to ship their work.', why: 'plain verbs' },
    { id: c.id, text: c.text, why: 'already fine' },
  ] } });
  const r = await suggest(project, [a, b, c], { ask });
  assert.equal(r.suggested, 1);
  assert.equal(r.unchanged, 1);
  assert.equal(r.refused[0].reason, 'drops the placeholder {name}');
  assert.equal(a.suggestion, undefined);
  assert.deepEqual(b.suggestion, { text: 'Teams use this to ship their work.', why: 'plain verbs', model: 'm', at: b.suggestion.at });
});

// ------------------------------------------------- whose words are these ---

test('a suggestion taken verbatim lands as ai-revised; one edited lands as human', async () => {
  await withProject({ 'a.md': 'Our robust platform empowers teams to unlock their potential.\n\nWe deliver seamless experiences for every single customer.\n' }, (proj, dir) => {
    const { ledger } = sync(proj, load(proj));
    const [x, y] = ledger.entries;
    x.suggestion = { text: 'Teams use this to ship their work.', why: '', model: 'm', at: '2026-10-05' };
    y.suggestion = { text: 'Every customer gets the same care.', why: '', model: 'm', at: '2026-10-05' };

    decide(x, { status: 'rewritten', replacement: 'Teams use this to ship their work.' });
    decide(y, { status: 'rewritten', replacement: 'Every customer gets the same care from us.' });
    assert.equal(x.replacement_source, 'model');
    assert.equal(y.replacement_source, undefined);

    // Caller cannot claim it: the source is worked out from the text.
    decide(y, { status: 'rewritten', replacement: 'Every customer gets the same care from us.', replacement_source: 'model' });
    assert.equal(y.replacement_source, undefined);

    writeback(proj, ledger, { apply: true });
    save(proj, ledger);
    assert.match(read(dir, 'a.md'), /Teams use this to ship their work\./);
    const byText = (t) => ledger.entries.find((e) => e.text === t);
    assert.equal(byText('Teams use this to ship their work.').status, 'ai-revised');
    assert.equal(byText('Every customer gets the same care from us.').status, 'human');
    assert.equal(byText('Teams use this to ship their work.').suggestion, undefined);

    const s = stats(ledger);
    assert.equal(s.done, 2);
    assert.equal(s.byStatus.human, 1);
    assert.equal(s.byStatus['ai-revised'], 1);

    // And a fresh sync keeps both as they are.
    const { ledger: again } = sync(proj, load(proj));
    assert.deepEqual(again.entries.map((e) => e.status).sort(), ['ai-revised', 'human']);
  });
});

test('a model rewrite committed as a pull request suggestion lands as ai-revised', () => {
  const draft = entry('Our robust platform empowers teams.');
  const theirs = 'Teams use this to ship.';
  draft.suggestion = { text: theirs };
  decide(draft, { status: 'rewritten', replacement: theirs });
  const { ledger, landed } = merge({ version: 1, retired: [], entries: [draft] }, [entry(theirs)]);
  assert.equal(landed.length, 1);
  assert.equal(ledger.entries[0].status, 'ai-revised');
  assert.equal(ledger.entries[0].previous_ai_text, draft.text);
  assert.equal(gate({ baseline: [] }, ledger).unledgered.length, 0);
});

test('triage and suggestions survive a sync, and nobody can choose ai-revised by hand', () => {
  const e = entry('Some paragraph a model drafted for the about page.', {
    triage: { verdict: 'rewrite', tells: [] }, suggestion: { text: 'A plainer paragraph.' },
  });
  const { ledger } = merge({ version: 1, retired: [], entries: [e] }, [entry(e.text)]);
  assert.equal(ledger.entries[0].triage.verdict, 'rewrite');
  assert.equal(ledger.entries[0].suggestion.text, 'A plainer paragraph.');
  assert.throws(() => decide(ledger.entries[0], { status: 'ai-revised' }), /bad status/);
  assert.equal(promote({ ...e, replacement: 'x' }, 'x').status, 'human');
});

test('the triage prompt keeps "fine" for copy with no voice, and never judges authorship', async () => {
  const { triagePrompt } = await import('../src/advice.js');
  const p = triagePrompt('');
  assert.match(p, /Never give "fine" to copy that carries voice/);
  assert.match(p, /accept "fine" strings in bulk/);
  assert.match(p, /Describe the text, never its author/);
  assert.match(p, /glance: it carries voice and reads plainly/);
});

test('an empty triage run says whether anything was unreviewed at all', async () => {
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const path = await import('node:path');
  await withProject({ 'a.md': 'A paragraph somebody already decided, long enough to count as helper text.\n' }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    ledger.baseline = [];
    ledger.entries[0].status = 'human';
    save(project, ledger);
    fs.writeFileSync(path.join(dir, '.slopchop.json'), JSON.stringify({ include: ['a.md'] }));
    const out = execFileSync(process.execPath, [path.resolve('bin/slopchop.js'), 'triage', '--config', path.join(dir, '.slopchop.json')], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    assert.match(out, /No unreviewed strings match/);
    assert.doesNotMatch(out, /already has an answer/);
  });
});
