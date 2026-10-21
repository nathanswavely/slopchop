// Attribute values that hold the other quote. `alt="Nathan's guitar"` once
// failed the attribute pattern, which stopped at any quote, so the value was
// never offered for review and a Reader never saw it on the page either. A
// value runs to the quote that opened it now; a `{…}` still refuses it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOne } from '../src/extract/index.js';
import { encodeFor, writeback } from '../src/writeback.js';
import { sync, load, decide } from '../src/ledger.js';
import { pageStrings, readPage } from '../src/reader.js';
import { slopId } from '../src/slop.js';
import { idFor } from '../src/extract/id.js';
import { withProject, read } from './helpers.js';

const found = (file, lang, src) => extractOne(file, lang, src).map((h) => [h.kind, h.text, h.quote]);

// --------------------------------------------------------------- extract ---

test('HTML: a value holds the other quote, and the entity form reads the same', () => {
  const hits = found('x.html', 'html', [
    '<img src="g.jpg" alt="Nathan\'s guitar, before the gig">',
    '<button title=\'Say "hi" to the band\'>Hi</button>',
    '<input placeholder="Pat&#39;s email">',
  ].join('\n'));
  for (const want of [
    ['html-attr:alt', "Nathan's guitar, before the gig", '"'],
    ['html-attr:title', 'Say "hi" to the band', "'"],
    ['html-attr:placeholder', "Pat's email", '"'],
  ]) assert.ok(hits.some((h) => h.join('|') === want.join('|')), want[1]);
});

test('meta: a description with an apostrophe, and one with double quotes inside single', () => {
  const hits = extractOne('x.html', 'html', [
    '<meta name="description" content="Hi, I\'m Nathan. I design and build things.">',
    '<meta property="og:description" content=\'The "loud" band, and its quiet bassist.\'>',
    '<meta name="keywords" content="Nathan\'s, keywords, nobody, reads">',
  ].join('\n'));
  assert.deepEqual(hits.map((h) => [h.kind, h.text, h.quote, h.at]), [
    ['html-attr:content', "Hi, I'm Nathan. I design and build things.", '"', 'meta description'],
    ['html-attr:content', 'The "loud" band, and its quiet bassist.', "'", 'meta og:description'],
  ]);
});

test('Astro: an element attribute and a component prop with an apostrophe', () => {
  const src = [
    '---',
    "import BaseLayout from '../layouts/BaseLayout.astro';",
    '---',
    '<BaseLayout',
    '  title="Nathan Swavely | Product Leader"',
    '  description="I run product for ConcertAI\'s commercial solutions."',
    '>',
    '  <img src="/a.jpg" alt="Showliner\'s marketing site, live room view" />',
    '  <img src="/b.jpg" alt={`${name}\'s photo`} />',
    '</BaseLayout>',
  ].join('\n');
  const hits = found('work.astro', 'astro', src);
  assert.ok(hits.some(([k, t, q]) => k === 'jsx-attr:description' && t === "I run product for ConcertAI's commercial solutions." && q === '"'), 'component prop');
  assert.ok(hits.some(([k, t, q]) => k === 'jsx-attr:alt' && t === "Showliner's marketing site, live room view" && q === '"'), 'alt');
  // An expression is still code, not copy.
  assert.ok(!hits.some(([, t]) => t.includes('photo')), 'no `{…}` value');
});

test('Svelte: a value holds the other quote; one with an expression in it is refused', () => {
  const hits = found('x.svelte', 'svelte', [
    '<img src="a.jpg" alt="Nathan\'s guitar" />',
    '<input placeholder=\'Type "yes" to confirm\' />',
    '<Card summary="The band\'s last tour, in photos" />',
    '<img src="b.jpg" alt="It\'s {name} on stage" />',
  ].join('\n'));
  for (const want of [
    ['attr:alt', "Nathan's guitar", '"'],
    ['attr:placeholder', 'Type "yes" to confirm', "'"],
    ['attr:summary', "The band's last tour, in photos", '"'],
  ]) assert.ok(hits.some((h) => h.join('|') === want.join('|')), want[1]);
  assert.ok(!hits.some(([, t]) => t.includes('on stage')), 'no `{…}` value');
});

test('JSX: an attribute and a component prop with the other quote', () => {
  const hits = found('Hero.jsx', 'jsx', [
    'export default function Hero() {',
    '  return (',
    '    <section>',
    '      <img src="/a.jpg" alt="Nathan\'s guitar, before the gig" />',
    '      <input placeholder=\'Type "yes" to confirm\' />',
    '      <Card caption="The band\'s last tour, in photos" />',
    '    </section>',
    '  );',
    '}',
  ].join('\n'));
  for (const want of [
    ['jsx-attr:alt', "Nathan's guitar, before the gig", '"'],
    ['jsx-attr:placeholder', 'Type "yes" to confirm', "'"],
    ['jsx-attr:caption', "The band's last tour, in photos", '"'],
  ]) assert.ok(hits.some((h) => h.join('|') === want.join('|')), want[1]);
});

// ---------------------------------------------------------------- Reader ---

test('Reader: an og:description with an apostrophe is on the page, under the source ID', async () => {
  const page = [
    '<!doctype html><html><head>',
    '<meta property="og:description" content="Hi, I\'m Nathan Swavely, designer and developer.">',
    '<meta name="twitter:description" content="Hi, I&#39;m Nathan Swavely, designer and developer.">',
    '</head><body><p>Hello.</p></body></html>',
  ].join('\n');
  const text = "Hi, I'm Nathan Swavely, designer and developer.";
  assert.deepEqual(pageStrings(page).find((s) => s.text === text),
    { text, where: ['meta og:description', 'meta twitter:description'], count: 2 });

  // The ID sync records for the source string is the one the page hashes to.
  const [hit] = extractOne('Layout.astro', 'astro', `<BaseLayout description="${text}" />`);
  assert.equal(hit.text, text);
  const r = await readPage(page, { slop: 1, copy: { [idFor(hit.text)]: 'human' } });
  assert.deepEqual(r.declared.map((x) => [x.text, x.status]), [[text, 'human']]);
  assert.equal(await slopId(text), idFor(text));
});

// ------------------------------------------------------------- writeback ---

test('a rewrite holding the closing quote is refused in attr: and jsx-attr:, encoded in html-attr:', () => {
  for (const kind of ['attr:alt', 'jsx-attr:alt']) {
    assert.ok(encodeFor(kind, '"', 'Say "hi"').problem, `${kind} "`);
    assert.ok(encodeFor(kind, "'", "It's here").problem, `${kind} '`);
    assert.equal(encodeFor(kind, '"', "It's here").value, "It's here");
    assert.equal(encodeFor(kind, "'", 'Say "hi"').value, 'Say "hi"');
  }
  assert.equal(encodeFor('html-attr:alt', '"', 'Say "hi"').value, 'Say &quot;hi&quot;');
  assert.ok(!encodeFor('html-attr:alt', "'", "It's here").value.includes("'"));
});

const FILES = {
  'index.html': [
    '<meta name="description" content="Hi, I\'m Nathan. I design and build things.">',
    '<img src="g.jpg" alt="Nathan\'s guitar, before the gig">',
    '',
  ].join('\n'),
  'work.astro': [
    '---',
    "import BaseLayout from '../layouts/BaseLayout.astro';",
    '---',
    '<BaseLayout description="I run product for ConcertAI\'s commercial solutions.">',
    '  <img src="/a.jpg" alt=\'The "live room" view, with a join code\' />',
    '</BaseLayout>',
    '',
  ].join('\n'),
  'Card.svelte': '<img src="a.jpg" alt="The band\'s last tour, in photos" />\n',
  'Hero.jsx': 'export const Hero = () => <img src="/a.jpg" alt="Nathan\'s amp, turned up" />;\n',
};

test('values with the other quote round-trip through sync, apply and sync again', async () => {
  const rewrites = [
    ["Hi, I'm Nathan. I design and build things.", 'I\'m Nathan, and I "build" things.'],
    ["Nathan's guitar, before the gig", 'The "old" guitar, and it\'s loud.'],
    ["I run product for ConcertAI's commercial solutions.", "I'm the product lead at ConcertAI."],
    ['The "live room" view, with a join code', 'The "live room" view again'],
    ["The band's last tour, in photos", "The band's next tour"],
    ["Nathan's amp, turned up", "Nathan's amp, louder"],
  ];
  await withProject(FILES, async (project, dir) => {
    const { ledger } = sync(project, load(project));
    for (const [from] of rewrites) assert.ok(ledger.entries.find((e) => e.text === from), `found: ${from}`);
    for (const [from, to] of rewrites) decide(ledger.entries.find((e) => e.text === from), { status: 'rewritten', replacement: to });
    const r = writeback(project, ledger, { apply: true });
    assert.deepEqual(r.blocked.map((b) => b.reason), []);
    assert.equal(r.occurrences, rewrites.length);

    // HTML encodes the quote that would close the attribute.
    assert.ok(read(dir, 'index.html').includes('alt="The &quot;old&quot; guitar, and it\'s loud."'));
    assert.ok(read(dir, 'work.astro').includes('description="I\'m the product lead at ConcertAI."'));
    assert.ok(read(dir, 'work.astro').includes('alt=\'The "live room" view again\''));

    // And sync finds each rewrite again, as the entry it became.
    const again = sync(project, ledger).ledger;
    for (const [, to] of rewrites) {
      const e = again.entries.find((x) => x.text === to);
      assert.ok(e, `lost after apply: ${to}`);
      assert.equal(e.id, idFor(to));
    }
  });
});

test('a rewrite that would close a markup attribute is blocked, and the file is untouched', async () => {
  await withProject(FILES, async (project, dir) => {
    const { ledger } = sync(project, load(project));
    const cases = [
      ["I run product for ConcertAI's commercial solutions.", 'Say "hi" to ConcertAI.'],
      ['The "live room" view, with a join code', "The room's view"],
      ["The band's last tour, in photos", 'The "last" tour'],
      ["Nathan's amp, turned up", 'The "amp"'],
    ];
    for (const [from, to] of cases) decide(ledger.entries.find((e) => e.text === from), { status: 'rewritten', replacement: to });
    const r = writeback(project, ledger, { apply: true });
    assert.equal(r.blocked.length, cases.length);
    for (const b of r.blocked) assert.match(b.reason, /closes the attribute/);
    for (const [rel, content] of Object.entries(FILES)) assert.equal(read(dir, rel), content, rel);
  });
});
