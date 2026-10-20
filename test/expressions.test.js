// Template expressions inside copy: not counted as words, never lost in a
// rewrite, and written back exactly as the source has them.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expressions, countWords, expressionProblem, syntaxFor, syntaxOf,
} from '../src/expressions.js';
import { sync, load, save, decide, merge } from '../src/ledger.js';
import { extractEntries, collapse } from '../src/extract/index.js';
import { writeback, encodeFor } from '../src/writeback.js';
import { withProject, read } from './helpers.js';

const SVELTE = { brace: true, dollar: true };

// The line from Patchwork that started this: 25 tokens, a handful of words.
const COUNCIL = "{seats.length} seat{seats.length === 1 ? '' : 's'} on the council, " +
  "{vacantSeats.length === 0 ? 'all held' : `${seats.length - vacantSeats.length} held and ${vacantSeats.length} vacant`}.";

test('expressions are found whole: nested braces, strings, and template literals inside them', () => {
  assert.deepEqual(expressions(COUNCIL, SVELTE).map((x) => x.text), [
    '{seats.length}',
    "{seats.length === 1 ? '' : 's'}",
    "{vacantSeats.length === 0 ? 'all held' : `${seats.length - vacantSeats.length} held and ${vacantSeats.length} vacant`}",
  ]);
  assert.deepEqual(expressions("{a ? '}' : `x${'{'}`} b", SVELTE).map((x) => x.text), ["{a ? '}' : `x${'{'}`}"]);
  assert.deepEqual(expressions('Hello ${name}, you have ${count} new', { dollar: true }).map((x) => x.text), ['${name}', '${count}']);
  assert.deepEqual(expressions('Hi {{ user.name }}, use {curly} braces', { mustache: true }).map((x) => x.text), ['{{ user.name }}']);
  assert.deepEqual(expressions('A brace { that never closes', SVELTE), []);
});

test('word counts leave expressions out, and text without them counts as before', () => {
  assert.equal(COUNCIL.split(/\s+/).length, 25);
  assert.equal(countWords(COUNCIL, SVELTE), 4);          // seat on the council,
  assert.equal(countWords('{count} items in your cart', SVELTE), 4);
  assert.equal(countWords('Saved {n}.', SVELTE), 1);      // the full stop is not a word
  assert.equal(countWords('One · two — three', SVELTE), 5);
  assert.equal(countWords('Literal {braces} in Markdown', null), 4);
});

test('which text can hold expressions depends on where it lives', () => {
  assert.deepEqual(syntaxFor('markup'), SVELTE);
  assert.deepEqual(syntaxFor('jsx-text'), SVELTE);
  assert.deepEqual(syntaxFor('html-text'), { mustache: true });
  assert.deepEqual(syntaxFor('js-string', '`'), { dollar: true });
  assert.equal(syntaxFor('js-string', "'"), null);
  assert.equal(syntaxFor('md-block'), null);
  assert.equal(syntaxFor('json-value', '"'), null);
  assert.deepEqual(syntaxOf([{ kind: 'md-block' }, { kind: 'js-string', quote: '`' }]), { dollar: true });
});

test('a rewrite may move words around expressions, and may not drop, change or add one', () => {
  const ok = "{seats.length} seat{seats.length === 1 ? '' : 's'} sit on the council now. " +
    "{vacantSeats.length === 0 ? 'all held' : `${seats.length - vacantSeats.length} held and ${vacantSeats.length} vacant`}.";
  assert.equal(expressionProblem(COUNCIL, ok, SVELTE), null);
  // Reordered is fine: the code is all still there.
  assert.equal(expressionProblem('{a} then {b}', 'First {b}, then {a}', SVELTE), null);
  // Whitespace inside an expression is not a change.
  assert.equal(expressionProblem('{a  +  b} total', 'Total: {a + b}', SVELTE), null);
  assert.match(expressionProblem('{a} then {b}', 'Only {a}', SVELTE), /^drops \{b\}/);
  assert.match(expressionProblem('{a} then {b}', '{a} then {c}', SVELTE), /^changes \{b\}/);
  assert.match(expressionProblem('{a} items', '{a} items {extra}', SVELTE), /^adds \{extra\}/);
  assert.equal(expressionProblem('{a} items', 'no syntax here', null), null);
});

test('sync extracts the text verbatim and counts only the words', async () => {
  await withProject({ 'Council.svelte': `<p>${COUNCIL}</p>\n` }, (project) => {
    const [e] = extractEntries(project);
    assert.equal(e.text, COUNCIL);
    assert.equal(e.occurrences[0].raw, COUNCIL);
    assert.equal(e.words, 4);
    assert.equal(e.tier, 'label');
  });
});

test('recounting words keeps every id and every decision through the next sync', async () => {
  const files = {
    'Council.svelte': [
      `<p>${COUNCIL}</p>`,
      '<p>{count} members joined the cooperative this year and {left} of them have since moved away for work.</p>',
      '<p>Welcome back, {user.name}. Your {plan} membership renews on {renewal} and nothing changes until then.</p>',
      '<p>{n} {n === 1 ? "patch" : "patches"} waiting on a second reviewer before they can be sewn into the quilt.</p>',
      '<p>{a} and {b} and {c} and {d} and {e} and {f} and {g} and {h} are all on the ballot this season.</p>',
      '<p>There are {total} open seats this term for anyone who lives inside the district lines.</p>',
      '<p>Meetings run {weekday} evenings at {time}, {place}.</p>',
    ].join('\n') + '\n',
  };
  await withProject(files, (project) => {
    // A ledger as 0.2.x wrote it: words counted with the code in them.
    const { ledger: first } = sync(project, load(project));
    const statuses = ['human', 'ai-fine', 'ai-revised', 'rewritten', 'not-copy', 'unreviewed', 'human'];
    assert.equal(first.entries.length, statuses.length);
    first.entries.forEach((e, i) => {
      e.status = statuses[i];
      e.words = collapse(e.text).split(/\s+/).length;
      e.tier = e.words < 6 ? 'label' : e.words < 16 ? 'helper' : 'prose';
      e.note = `note ${i}`;
      if (e.status === 'rewritten') { e.replacement = `${e.text} Rewritten.`; e.authorship = { kind: 'written' }; }
      if (e.status === 'human') e.authorship = { kind: 'claimed' };
    });
    first.baseline = [];
    save(project, first);
    const before = load(project);

    const { ledger: after, added, removed } = sync(project, before);
    assert.equal(added.length, 0);
    assert.equal(removed.length, 0);
    assert.deepEqual(after.entries.map((e) => e.id), before.entries.map((e) => e.id));
    assert.deepEqual(after.entries.map((e) => e.status), statuses);
    assert.deepEqual(after.entries.map((e) => e.note), before.entries.map((e) => e.note));
    assert.deepEqual(after.entries.map((e) => e.text), before.entries.map((e) => e.text));
    assert.equal(after.entries[3].replacement, before.entries[3].replacement);
    assert.deepEqual(after.entries[0].authorship, { kind: 'claimed' });

    // The counts did change, and some prose became helper text.
    for (const [i, e] of after.entries.entries()) assert.ok(e.words < before.entries[i].words, e.text);
    assert.ok(before.entries.filter((e) => e.tier === 'prose').length >
              after.entries.filter((e) => e.tier === 'prose').length);

    // And nothing is lost on a second pass either.
    const again = merge(after, extractEntries(project)).ledger;
    assert.deepEqual(again.entries.map((e) => e.status), statuses);
  });
});

test('apply writes a rewrite around its expressions, with each one exactly as the source had it', async () => {
  const src = '<p>{count} {count === 1 ? "patch" : "patches"} waiting\n  on {reviewers.join(", ")}.</p>\n';
  await withProject({ 'Queue.svelte': src }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    const [e] = ledger.entries;
    assert.equal(e.words, 2);
    decide(e, { status: 'rewritten', replacement: 'Still waiting on {reviewers.join(", ")}: {count} {count === 1 ? "patch" : "patches"}.' });
    const r = writeback(project, ledger, { apply: true });
    assert.equal(r.blocked.length, 0);
    assert.equal(read(dir, 'Queue.svelte'),
      '<p>Still waiting on {reviewers.join(", ")}: {count} {count === 1 ? "patch" : "patches"}.</p>\n');
    assert.equal(ledger.entries[0].status, 'human');
    assert.equal(ledger.entries[0].words, 3);
  });
});

test('apply refuses a rewrite that drops an expression, and a brace that is not one', async () => {
  await withProject({ 'Seat.svelte': '<p>{count} seats are open on the council.</p>\n' }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    decide(ledger.entries[0], { status: 'rewritten', replacement: 'Some seats are open on the council.' });
    let r = writeback(project, ledger, { apply: false });
    assert.match(r.blocked[0].reason, /drops \{count\}/);

    decide(ledger.entries[0], { status: 'rewritten', replacement: '{count} seats are {open}.' });
    r = writeback(project, ledger, { apply: false });
    assert.match(r.blocked[0].reason, /adds \{open\}/);
    assert.equal(read(dir, 'Seat.svelte'), '<p>{count} seats are open on the council.</p>\n');
  });
});

test('a JS template string keeps its ${…} and has backticks in its words escaped', () => {
  // The JS extractor does not collect template strings with ${…} today, so
  // this is the encoder on its own: ready for when it does.
  const raw = 'You have ${n} new messages waiting for you';
  const enc = encodeFor('js-string', '`', '${n} messages are waiting, `fresh` ones', { raw });
  assert.equal(enc.value, '${n} messages are waiting, \\`fresh\\` ones');
  assert.match(encodeFor('js-string', '`', 'Messages are waiting', { raw }).problem, /drops \$\{n\}/);
  assert.equal(countWords(raw, syntaxFor('js-string', '`')), 7);
});
