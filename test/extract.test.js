// The extractor properties carried over from the tool's first home. Each of
// these was a real miss once; they are tested rather than remembered.

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOne } from '../src/extract/index.js';
import { encodeFor } from '../src/writeback.js';

// ------------------------------------------------------------ Go errors ---

const GO = [
  'package handler',
  '',
  'func H(w http.ResponseWriter) {',
  '\thttp.Error(w, `{"error":"only an admin of this patch can record a decision"}`, 403)',
  '\thttp.Error(w, `{"error":"node not found"}`, 404)',
  '\t// http.Error(w, `{"error":"a commented-out refusal"}`, 400)',
  '\tlog.Printf("election: %s seated %d", slug, n)',
  '\tdb.Exec(`SELECT id FROM nodes WHERE slug = ?`, slug)',
  '}',
].join('\n');

test('an API error message is claimed, and nothing around it is', () => {
  const hits = extractOne('x.go', 'go-errors', GO);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('only an admin of this patch can record a decision'));
  assert.ok(texts.includes('node not found'));
  assert.ok(!texts.some((t) => t.includes('seated')));
  assert.ok(!texts.some((t) => t.includes('SELECT')));
  assert.ok(!texts.some((t) => t.includes('commented-out')));
  for (const h of hits) assert.ok(!h.raw.includes('{"error"') && !h.raw.includes('`'));
});

test('a replacement lands inside the error wrapper and leaves it parseable', () => {
  const hit = extractOne('x.go', 'go-errors', GO).find((h) => h.text === 'node not found');
  const enc = encodeFor(hit.kind, hit.quote, 'we could not find that "patch"');
  assert.equal(enc.problem, undefined);
  const after = GO.replace(hit.raw, enc.value);
  const body = after.match(/`(\{"error":"we could not find[^`]*\})`/)[1];
  assert.equal(JSON.parse(body).error, 'we could not find that "patch"');
  assert.ok(encodeFor('go-error-body', null, 'use `make dev`').problem);
});

test('frozen Go constants are never offered', () => {
  const src = 'package x\n\nconst legacy = `This charter text is matched byte for byte.`\nconst live = `This one is fair game for a rewrite.`\n';
  const texts = extractOne('x.go', 'go', src, { frozen: new Set(['legacy']) }).map((h) => h.text);
  assert.deepEqual(texts, ['This one is fair game for a rewrite.']);
});

test('a SQL query is not copy, and a sentence that opens like one still is', () => {
  const q = 'package n\n\nfunc F() {\n\tdb.Query(`SELECT id, name FROM nodes WHERE slug = ?`)\n}';
  assert.equal(extractOne('x.go', 'go', q).length, 0);
  const s = 'package g\n\nvar Copy = []string{\n\t"Select a patch to continue.",\n\t"Update your event details.",\n}';
  const texts = extractOne('x.go', 'go', s).map((h) => h.text);
  assert.ok(texts.includes('Select a patch to continue.'));
  assert.ok(texts.includes('Update your event details.'));
});

// --------------------------------------------------------------- Svelte ---

const IFELSE = [
  '<p class="term-line">',
  '  {#if termLapsed}',
  "    This council's term ended {formatDay(end)}. It serves until a successor is elected.",
  '  {:else}',
  '    Next seat comes up {formatDay(end)}.',
  '  {/if}',
  '</p>',
].join('\n');

test('both branches of a Svelte conditional are offered, and the directives are not', () => {
  const hits = extractOne('X.svelte', 'svelte', IFELSE).filter((h) => h.kind === 'markup');
  const texts = hits.map((h) => h.text);
  assert.equal(texts.length, 2);
  assert.ok(texts.some((t) => t.startsWith("This council's term ended")));
  assert.ok(texts.some((t) => t.startsWith('Next seat comes up')));
  for (const h of hits) assert.equal(IFELSE.split(h.raw).length - 1, 1, `not unique: ${h.raw}`);
});

test('an expression inside Svelte copy survives, nested ones included', () => {
  const src = "<p>\n  Reports go to the admins.{name ? ` You're reporting ${name}.` : ''}\n</p>";
  const texts = extractOne('X.svelte', 'svelte', src).filter((h) => h.kind === 'markup').map((h) => h.text);
  assert.equal(texts.length, 1);
  assert.ok(texts[0].startsWith('Reports go to the admins.'));
});

test('attribute residue is refused rather than filed as copy', () => {
  const src = '<button onclick={() => { open = false; }} title="x">Close</button>';
  for (const h of extractOne('X.svelte', 'svelte', src)) {
    assert.ok(!/[{}]|=>|="/.test(h.text), `code filed as copy: ${h.text}`);
  }
});

test('Svelte script strings and attributes are copy; the script is not markup', () => {
  const src = '<script>\n  const msg = "Saved your changes.";\n</script>\n<input placeholder="Search patches" />';
  const hits = extractOne('X.svelte', 'svelte', src);
  assert.ok(hits.some((h) => h.kind === 'js-string' && h.text === 'Saved your changes.'));
  assert.ok(hits.some((h) => h.kind === 'attr:placeholder' && h.text === 'Search patches'));
});

// ------------------------------------------------------------------- JS ---

test('media queries are not offered for review', () => {
  for (const q of ['(max-width: 768px)', '(hover: hover) and (pointer: fine)', '(prefers-color-scheme: dark)']) {
    assert.equal(extractOne('x.js', 'js', `const m = window.matchMedia('${q}');`).length, 0, q);
  }
});

test('a parenthetical sentence is still copy, and comments never are', () => {
  const src = "// 'Not this comment sentence here.'\nconst msg = '(Optional) Add a short description.';\nconst url = 'https://example.com/a path';";
  const texts = extractOne('x.js', 'js', src).map((h) => h.text);
  assert.deepEqual(texts, ['(Optional) Add a short description.']);
});

test('a JS string round-trips with its quote escaped', () => {
  const enc = encodeFor('js-string', "'", "Don't stop");
  assert.equal(enc.value, "Don\\'t stop");
  assert.ok(encodeFor('js-string', "'", 'two\nlines').problem);
});
