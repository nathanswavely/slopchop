// String literals with escapes in them. `'Let\'s talk'` once looked like
// code to the extractor (it holds a backslash), so a sentence with an
// apostrophe in a single-quoted string was never offered for review, and
// check passed without it. The entry records the text as it renders; the
// occurrence keeps the escapes, because writeback matches what is on disk.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { extractOne } from '../src/extract/index.js';
import { unescapeString, isProseLiteral } from '../src/extract/common.js';
import { idFor } from '../src/extract/id.js';
import { encodeFor, writeback } from '../src/writeback.js';
import { sync, load, save, decide, migrate, gate } from '../src/ledger.js';
import { pageStrings } from '../src/reader.js';
import { slopId } from '../src/slop.js';
import { withProject, read } from './helpers.js';

const js = (src, lang = 'js') => extractOne(`x.${lang}`, lang, src);

// --------------------------------------------------------------- extract ---

test('a sentence with an escaped quote is copy, recorded as it renders', () => {
  const src = [
    "const a = { description: 'Hi, I\\'m Pat, and I fix bikes on weekends.' };",
    'const b = "She said \\"come back soon\\" and meant it.";',
    'const c = `Backticks \\` and a dollar \\$ are fine too.`;',
    "const d = { cta: { text: 'Let\\'s talk' } };",
  ].join('\n');
  const hits = js(src);
  assert.deepEqual(hits.map((h) => [h.text, h.raw, h.quote]), [
    ["Hi, I'm Pat, and I fix bikes on weekends.", "Hi, I\\'m Pat, and I fix bikes on weekends.", "'"],
    ['She said "come back soon" and meant it.', 'She said \\"come back soon\\" and meant it.', '"'],
    ['Backticks ` and a dollar $ are fine too.', 'Backticks \\` and a dollar \\$ are fine too.', '`'],
    ["Let's talk", "Let\\'s talk", "'"],
  ]);
  // raw is the exact source between the quotes, so writeback finds it.
  for (const h of hits) assert.ok(src.includes(`${h.quote}${h.raw}${h.quote}`), h.raw);
});

test('every common escape resolves to the character it stands for', () => {
  assert.equal(unescapeString("It\\'s a \\\"quote\\\" and a \\\\ slash"), 'It\'s a "quote" and a \\ slash');
  assert.equal(unescapeString('Line one.\\nLine two.\\tTabbed.'), 'Line one.\nLine two.\tTabbed.');
  assert.equal(unescapeString('A dash \\u2014 and \\u{1F600} and \\x41.'), 'A dash — and 😀 and A.');
  assert.equal(unescapeString('Joined \\\nacross a line'), 'Joined across a line');
  assert.equal(unescapeString('Nothing to do here'), 'Nothing to do here');
  // A template literal's expressions are code, left exactly as written.
  assert.equal(unescapeString("It\\'s ${n ? 'Pat\\'s' : ''} turn", { template: true }), "It's ${n ? 'Pat\\'s' : ''} turn");
  // Go: \x and octal escapes are UTF-8 bytes.
  assert.equal(unescapeString('A dash \\xe2\\x80\\x94 here \\342\\200\\224 too', { go: true }), 'A dash — here — too');
});

test('escapes inside a sentence are words; a sentence-length line of them renders as one line', () => {
  const [h] = js("const m = 'First we wait.\\nThen it\\'s ready.';");
  assert.equal(h.text, "First we wait. Then it's ready.");
  assert.equal(h.raw, "First we wait.\\nThen it\\'s ready.");
});

test('a backslash that survives unescaping is still code', () => {
  for (const s of [
    "'C:\\\\Users\\\\Pat\\\\Documents are here'",      // a Windows path
    "'^\\\\d+ items? left$'",                         // a regex
    "'Match \\\\s+ and \\\\w+ only'",
  ]) assert.deepEqual(js(`const x = ${s};`), [], s);
});

test('markup, URLs and other code in a string literal are still not copy', () => {
  for (const s of [
    "'<b>Bold</b> text goes here'",
    "'https://example.com/a path'",
    "'Use a|b to pick either'",
    "'Count == total here'",
    "'Hello {name}, welcome'",
    "'Logical a || b here'",
  ]) assert.deepEqual(js(`const x = ${s};`), [], s);
});

test('an underscore, a spaced pipe, and a URL inside a sentence do not make it code', () => {
  const src = [
    "const a = 'Set NODE_ENV before you deploy.';",
    "const b = 'Pricing | Northwind Tools';",
    "const c = 'Read the guide at https://example.com before you start.';",
  ].join('\n');
  assert.deepEqual(js(src).map((h) => h.text), [
    'Set NODE_ENV before you deploy.',
    'Pricing | Northwind Tools',
    'Read the guide at https://example.com before you start.',
  ]);
  assert.ok(isProseLiteral('Fill in the ____ and send it.'));
});

test('a Go string with escaped quotes is copy, unescaped', () => {
  const src = 'package x\n\nvar msg = "Say \\"hello\\" to the new team"\n';
  const [h] = extractOne('x.go', 'go', src).filter((x) => x.kind === 'go-string');
  assert.equal(h.text, 'Say "hello" to the new team');
  assert.equal(h.raw, 'Say \\"hello\\" to the new team');
});

test('a short string for a rendered key is unescaped too', () => {
  const src = "const items = [{ name: 'Don\\'t' }];\nconst el = <li>{item.name}</li>;";
  const h = extractOne('x.jsx', 'jsx', src).find((x) => x.at === 'name');
  assert.equal(h.text, "Don't");
  assert.equal(h.raw, "Don\\'t");
});

test('in .astro, .svelte and .vue scripts, the same literal reads the same', () => {
  const lit = "const t = 'Hi, I\\'m Pat, and I fix bikes.';";
  const want = "Hi, I'm Pat, and I fix bikes.";
  assert.ok(extractOne('x.astro', 'astro', `---\n${lit}\n---\n<p>{t}</p>`).some((h) => h.text === want));
  assert.ok(extractOne('x.svelte', 'svelte', `<script>\n${lit}\n</script>\n<p>{t}</p>`).some((h) => h.text === want));
  assert.ok(extractOne('x.vue', 'vue', `<template><p>{{ t }}</p></template>\n<script>\n${lit}\n</script>`).some((h) => h.text === want));
});

// ---------------------------------------------------------------- the ID ---

test('the ID of an unescaped literal is the one a Reader hashes from the page', async () => {
  const [h] = js("const cta = { text: 'Let\\'s talk \\u2014 it\\'s free' };");
  const id = idFor(h.text);
  // However the page writes it, the DOM text is the same, and so is the hash.
  for (const page of [
    "<button>Let's talk — it's free</button>",
    '<button>Let&#39;s talk &mdash; it&apos;s free</button>',
    '<button>\n  Let&#x27;s talk\n  &#8212; it&#39;s free\n</button>',
  ]) {
    const [s] = pageStrings(page);
    assert.equal(await slopId(s.text), id, page);
  }
  assert.equal(await slopId(h.text), id);
});

// ------------------------------------------------------------- writeback ---

test('a rewrite is escaped for the quote of the literal it lands in', () => {
  const text = 'It\'s "done" \\ now ${x} `here`';
  assert.equal(encodeFor('js-string', "'", text).value, 'It\\\'s "done" \\\\ now ${x} `here`');
  assert.equal(encodeFor('js-string', '"', text).value, 'It\'s \\"done\\" \\\\ now ${x} `here`');
  assert.equal(encodeFor('js-string', '`', text).value, 'It\'s "done" \\\\ now \\${x} \\`here\\`');
  // Each one reads back, in JavaScript, as the text.
  for (const q of ["'", '"', '`']) {
    const lit = `${q}${encodeFor('js-string', q, text).value}${q}`;
    assert.equal(vm.runInNewContext(lit, { x: 'NO' }), text, q);
  }
});

test('a JSX-file string that escapes its own quote is a JS literal, and is written as one', () => {
  const raw = "Let\\'s talk";
  assert.equal(encodeFor('jsx-string', "'", "Let's go", { raw }).value, "Let\\'s go");
  // One that does not may be an attribute value, which has no escapes.
  assert.ok(encodeFor('jsx-string', "'", "Let's go", { raw: 'Talk to us' }).problem);
});

test('escaped literals round-trip through sync, apply and sync again', async () => {
  const src = [
    "export const a = 'Hi, I\\'m Pat, and I fix bikes on weekends.';",
    'export const b = "She said \\"come back soon\\" and meant it.";',
    'export const c = `Backticks \\` are fine in here too.`;',
    "export const d = { cta: { text: 'Let\\'s talk' } };",
    '',
  ].join('\n');
  const rewrites = [
    ["Hi, I'm Pat, and I fix bikes on weekends.", 'I\'m Pat. I fix "bikes" on weekends.'],
    ['She said "come back soon" and meant it.', 'She\'s "sure" we\'ll be back.'],
    ['Backticks ` are fine in here too.', 'A `tick` and a $5 fee, both text.'],
    ["Let's talk", "Let's chat"],
  ];
  await withProject({ 'src/copy.js': src }, async (project, dir) => {
    const { ledger } = sync(project, load(project));
    assert.deepEqual(ledger.entries.map((e) => e.text), rewrites.map(([from]) => from));
    for (const [from, to] of rewrites) decide(ledger.entries.find((e) => e.text === from), { status: 'rewritten', replacement: to });
    const r = writeback(project, ledger, { apply: true });
    assert.deepEqual(r.blocked.map((b) => b.reason), []);
    assert.equal(r.occurrences, 4);

    // The file is still JavaScript, and says what the reviewer wrote.
    const out = read(dir, 'src/copy.js');
    const values = vm.runInNewContext(`${out.replace(/export const /g, 'var ')}; ({ a, b, c, d: d.cta.text })`);
    assert.deepEqual(Object.values(values), rewrites.map(([, to]) => to));

    // And sync finds each rewrite again, as the entry it became.
    const again = sync(project, ledger).ledger;
    for (const [, to] of rewrites) {
      const e = again.entries.find((x) => x.text === to);
      assert.ok(e, `lost after apply: ${to}`);
      assert.equal(e.id, idFor(to));
      assert.ok(out.includes(e.occurrences[0].raw), `raw is on disk: ${e.occurrences[0].raw}`);
    }
  });
});

// ----------------------------------------------------------- migration ---

const ESCAPED = "It\\'s the table\\'s night";
const SHOWN = "It's the table's night";
const legacyLedger = () => ({
  version: 1, strict: false, retired: [],
  baseline: [idFor(ESCAPED)],
  entries: [
    // As a ledger could hold one before: the escapes kept as typed.
    {
      id: idFor(ESCAPED), text: ESCAPED, words: 4, tier: 'label', status: 'human',
      authorship: { kind: 'claimed' }, note: 'mine', replacement: null,
      occurrences: [
        { file: 'src/a.ts', line: 1, kind: 'js-string', raw: ESCAPED, quote: "'" },
        { file: 'src/b.ts', line: 1, kind: 'js-string', raw: ESCAPED, quote: "'" },
      ],
    },
  ],
});

test('a ledger with escapes as typed keeps its decisions under the text as it renders', async () => {
  const src = `export const t = '${ESCAPED}';\n`;
  await withProject({ 'src/a.ts': src, 'src/b.ts': src }, (project, dir) => {
    fs.mkdirSync(path.join(dir, 'copy'));
    fs.writeFileSync(project.ledgerPath, JSON.stringify(legacyLedger(), null, 2));
    const onDisk = load(project);
    const { ledger, added } = sync(project, onDisk);
    assert.deepEqual(added, [], 'nothing comes up as new');
    assert.deepEqual(ledger.retired, [], 'nothing is orphaned');

    const [e] = ledger.entries;
    assert.equal(e.text, SHOWN);
    assert.equal(e.id, idFor(SHOWN));
    assert.equal(e.status, 'human');
    assert.deepEqual(e.authorship, { kind: 'claimed' });
    assert.equal(e.note, 'mine');
    assert.equal(e.occurrences.length, 2);
    assert.deepEqual(ledger.baseline, [idFor(SHOWN)], 'baseline debt follows its string');
    assert.deepEqual(gate(onDisk, ledger).unledgered, []);

    save(project, ledger);
    assert.deepEqual(sync(project, load(project)).ledger, ledger, 'idempotent');
  });
});

test('an escaped entry the old way cannot reproduce is left for sync, not guessed at', () => {
  const mixed = legacyLedger();
  mixed.entries[0].occurrences[1] = { file: 'src/b.astro', line: 1, kind: 'jsx-text', raw: ESCAPED, quote: null };
  assert.equal(migrate(mixed), mixed, 'JSX text shows its backslash, so the two are not one string any more');

  const drifted = legacyLedger();
  drifted.entries[0].occurrences[1].raw = "It\\'s a different night";
  assert.equal(migrate(drifted), drifted, 'an occurrence that does not give the stored text');

  const plain = legacyLedger();
  for (const o of plain.entries[0].occurrences) o.raw = SHOWN;
  plain.entries[0].text = SHOWN;
  plain.entries[0].id = idFor(SHOWN);
  assert.equal(migrate(plain), plain, 'nothing to read: untouched');
});
