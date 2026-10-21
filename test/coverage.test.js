// Reader coverage: what sync records is what a page shows, so a Reader on
// the built page finds it. Gaps found by reading a real Astro site's 404
// page: entities the CLI left raw, props passed to a layout, short names in
// a data file, and a <meta> nobody reads.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { decodeEntities } from '../src/extract/common.js';
import { namedEntity } from '../src/extract/entities.js';
import { extractOne, extractEntries, idFor } from '../src/extract/index.js';
import { renderedKeys } from '../src/extract/rendered.js';
import { load, save, sync, migrate, gate } from '../src/ledger.js';
import { writeback } from '../src/writeback.js';
import { buildDisclosure } from '../src/disclosure.js';
import { readPage, pageStrings } from '../src/reader.js';
import { bundleModules, bookmarkletSource } from '../src/bundle.js';
import { withProject, read } from './helpers.js';

const texts = (file, lang, src) => extractOne(file, lang, src).map((h) => h.text);

// ------------------------------------------------------------ entities ---

test('every name HTML defines decodes, as a browser decodes it', () => {
  assert.equal(decodeEntities('Next &rarr;'), 'Next →');
  assert.equal(decodeEntities('&frac12; cup &amp; a &check;'), '½ cup & a ✓');
  assert.equal(decodeEntities('&NotEqualTilde;'), '≂̸', 'two code points');
  assert.equal(decodeEntities('&Rarr; &rarr;'), '↠ →', 'names are case-sensitive');
  assert.equal(namedEntity('constructor'), undefined);
});

test('numeric references follow the browser rules', () => {
  assert.equal(decodeEntities('&#8594; &#x2192; &#X2192;'), '→ → →');
  assert.equal(decodeEntities('&#169 2026'), '© 2026', 'a numeric reference needs no ;');
  assert.equal(decodeEntities('&#150; &#x93;quoted&#x94;'), '– “quoted”', 'windows-1252 in the C1 range');
  assert.equal(decodeEntities('&#0;&#xD800;&#x110000;&#99999999999;'), '�'.repeat(4), 'nothing a string can hold');
});

test('an unknown name, or a name without its ;, stays as typed', () => {
  assert.equal(decodeEntities('&bogus; &copy 2026 AT&T'), '&bogus; &copy 2026 AT&T');
});

test('the bookmarklet asks the browser, and never ships the table', () => {
  assert.doesNotMatch(bookmarkletSource(), /NotEqualTilde|1d56b/);
  const m = new Function('document', `const m = {};\n${bundleModules('extract/common.js')}\nreturn m;`)({
    // A <textarea> decodes what it is given and builds nothing.
    createElement: () => ({
      set innerHTML(s) { this.value = s === '&rarr;' ? '→' : s; },
    }),
  });
  assert.equal(m['extract/common.js'].decodeEntities('Next &rarr; &bogus; &amp;'), 'Next → &bogus; &');
});

test('a lone symbol is not copy, written as an entity or as itself', () => {
  for (const [file, lang, src] of [
    ['a.html', 'html', '<a href="/">&rarr;</a><a href="/">→</a><span>&times;</span>'],
    ['a.astro', 'astro', '<a href="/">&rarr;</a><span aria-hidden="true">&#8594;</span>'],
    ['a.svelte', 'svelte', '<a href="/">&rarr;</a>'],
    ['a.jsx', 'jsx', 'export const A = () => <a href="/">&rarr;</a>;'],
  ]) assert.deepEqual(texts(file, lang, src), [], file);
});

test('text and copy attributes are recorded decoded, in every markup language', () => {
  const html = '<a title="Tom &amp; Jerry" href="/">Next &rarr;</a>';
  assert.deepEqual(texts('a.html', 'html', html).sort(), ['Next →', 'Tom & Jerry']);
  assert.deepEqual(texts('a.astro', 'astro', html).sort(), ['Next →', 'Tom & Jerry']);
  assert.deepEqual(texts('a.svelte', 'svelte', html).sort(), ['Next →', 'Tom & Jerry']);
  assert.deepEqual(texts('a.jsx', 'jsx', `export const A = () => ${html};`).sort(), ['Next →', 'Tom & Jerry']);
});

test('the CLI Reader and the bookmarklet see the same strings', async () => {
  // The CLI reads the file as built; the bookmarklet reads what the DOM
  // serializes, which writes every character as itself but & < > ".
  const built = '<main><h1>Pick one</h1><a href="/dev">Dev</a><span aria-hidden="true">&rarr;</span>'
    + '<p>Tools you&rsquo;ll hand down &mdash; &frac12; price</p></main>';
  const dom = '<main><h1>Pick one</h1><a href="/dev">Dev</a><span aria-hidden="true">→</span>'
    + '<p>Tools you’ll hand down — ½ price</p></main>';
  assert.deepEqual(pageStrings(built), pageStrings(dom));
  assert.deepEqual(pageStrings(built).map((s) => s.text), ['Pick one', 'Dev', 'Tools you’ll hand down — ½ price']);
});

// ---------------------------------------------------- meta keywords ---

test('<meta name="keywords"> is not copy: nothing shows it to anyone', async () => {
  const page = '<head><meta name="keywords" content="web design Lancaster PA, graphic design">'
    + '<meta name="description" content="Design in Lancaster."></head><body><p>Hello there</p></body>';
  assert.deepEqual(texts('a.html', 'html', page).sort(), ['Design in Lancaster.', 'Hello there']);
  const r = await readPage(page, { slop: 1, copy: {} });
  assert.deepEqual(r.undeclared.map((x) => x.text).sort(), ['Design in Lancaster.', 'Hello there']);
  assert.equal(r.counts.total, 2);
});

// ------------------------------------------------------ component props ---

const PAGE = [
  '---',
  "import BaseLayout from '../layouts/BaseLayout.astro';",
  '---',
  '<BaseLayout',
  '  title="404, page not found"',
  '  description="That page is not here. Pick a Nathan that is."',
  '  initialBackgroundColor={home.color}',
  '  onLoad={() => go(a > b)}',
  '>',
  '  <Card label="Read the case study" heading="Patchwork" variant="wide" text="primary-nav" />',
  '  <p description="not a component, not a prop">Body copy here.</p>',
  '</BaseLayout>',
].join('\n');

test('a string passed to a component under a copy-like name is copy', () => {
  const hits = extractOne('404.astro', 'astro', PAGE);
  const by = (t) => hits.find((h) => h.text === t);
  assert.equal(by('That page is not here. Pick a Nathan that is.').kind, 'jsx-attr:description');
  assert.equal(by('That page is not here. Pick a Nathan that is.').line, 6);
  assert.equal(by('Read the case study').kind, 'jsx-attr:label');
  assert.equal(by('Patchwork').kind, 'jsx-attr:heading');
  assert.ok(by('404, page not found'), 'title, as on any tag');
  assert.ok(!by('wide'), 'variant is not a copy name');
  assert.ok(!by('primary-nav'), 'an identifier is not copy, whatever the prop');
  assert.ok(!by('not a component, not a prop'), 'description is no HTML attribute');
});

test('component props in JSX and Svelte, too', () => {
  assert.deepEqual(texts('a.jsx', 'jsx', 'export default () => <Hero subtitle="Tools you keep" />;'), ['Tools you keep']);
  assert.deepEqual(texts('a.svelte', 'svelte', '<Hero caption="Tools you keep" />'), ['Tools you keep']);
});

test('a rewritten component prop is written back into the prop', async () => {
  await withProject({ 'src/404.astro': PAGE }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    const e = ledger.entries.find((x) => x.text === 'That page is not here. Pick a Nathan that is.');
    e.status = 'rewritten';
    e.replacement = 'Nothing here. Try another Nathan.';
    const r = writeback(project, ledger, { apply: true });
    assert.equal(r.blocked.length, 0);
    assert.match(read(dir, 'src/404.astro'), /^ {2}description="Nothing here\. Try another Nathan\."$/m);
  });
});

// -------------------------------------------------------- rendered keys ---

const SERVICES = [
  "import type { Service } from './types';",
  'export const services: Service[] = [',
  "  { id: 'home', name: 'Hello', color: 'var(--color-cyan)', image: 'nathan.png',",
  "    cta: { text: 'Get in Touch', link: '#contact' } },",
  "  { id: 'dev', name: 'Dev', color: 'var(--color-orange)', image: 'dev.png',",
  "    // name: 'Commented out'",
  "    cta: { text: 'Build Something', link: '#contact' } },",
  '];',
  "export const when = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });",
].join('\n');

const LIST = [
  '---',
  "import { services, when } from '../services';",
  "const socials = [{ name: 'LinkedIn', url: 'https://linkedin.com/in/x' }];",
  "const { label = 'Menu' } = Astro.props;",
  'const month = when(new Date());',
  '---',
  '<ul aria-label={label}>',
  '  {services.map((service) => (',
  '    <li><a href={`/${service.id}`} style={`--c: ${service.color};`}>',
  '      <span>{service.name}</span> <b>{service.cta?.text}</b></a></li>',
  '  ))}',
  '  {socials.map(({ name, url }) => <a href={url} title={name}>x</a>)}',
  '</ul>',
  '<time>{month}</time>',
].join('\n');

test('the keys a template shows: text and copy attributes, not href or style', () => {
  const keys = renderedKeys(LIST.split('---')[2]);
  assert.deepEqual([...keys].sort(), ['label', 'month', 'name', 'text']);
  assert.deepEqual([...renderedKeys('<img {src} alt={photo.caption}>')], ['caption'], "Svelte's {src} shorthand is an attribute");
});

test('a short string a template renders is copy; ids, colours, links and format options are not', async () => {
  await withProject({ 'src/services.ts': SERVICES, 'src/List.astro': LIST }, (project) => {
    const entries = extractEntries(project);
    const t = entries.map((e) => e.text);
    for (const s of ['Hello', 'Dev', 'Get in Touch', 'Build Something', 'LinkedIn', 'Menu']) assert.ok(t.includes(s), s);
    for (const s of ['home', 'dev', 'nathan.png', '#contact', 'short', 'numeric', 'Commented out']) assert.ok(!t.includes(s), s);
    const hello = entries.find((e) => e.text === 'Hello').occurrences[0];
    assert.deepEqual([hello.file, hello.line, hello.kind, hello.at, hello.quote], ['src/services.ts', 3, 'js-string', 'name', "'"]);
  });
});

test('a key nothing renders leaves its strings alone, and ignoreKeys still wins', async () => {
  await withProject({ 'src/services.ts': SERVICES }, (project) => {
    // Only what is sentence-shaped, as ever.
    assert.deepEqual(extractEntries(project).map((e) => e.text), ['Get in Touch', 'Build Something']);
  });
  await withProject({ 'src/services.ts': SERVICES, 'src/List.astro': LIST }, (project) => {
    const t = extractEntries(project).map((e) => e.text);
    assert.ok(!t.includes('Hello') && t.includes('Get in Touch'));
  }, { ignoreKeys: ['name'] });
});

test('a short rendered string is written back into its literal', async () => {
  await withProject({ 'src/services.ts': SERVICES, 'src/List.astro': LIST }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    const e = ledger.entries.find((x) => x.text === 'Get in Touch');
    e.status = 'rewritten';
    e.replacement = "Let's talk";
    assert.equal(writeback(project, ledger, { apply: true }).blocked.length, 0);
    assert.match(read(dir, 'src/services.ts'), /text: 'Let\\'s talk'/);
  });
});

test('a Reader on the built page finds the props, the names and the arrow', async () => {
  await withProject({ 'src/services.ts': SERVICES, 'src/List.astro': LIST, 'src/404.astro': PAGE }, async (project) => {
    const { ledger } = sync(project, load(project));
    for (const e of ledger.entries) e.status = 'ai-fine';
    const d = await buildDisclosure(project, ledger, { block: { enabled: true } });
    const built = '<head><meta property="og:description" content="That page is not here. Pick a Nathan that is.">'
      + '<meta name="keywords" content="web design, dev"></head><body><ul aria-label="Menu">'
      + '<li><a href="/home"><span>Hello</span> <b>Get in Touch</b></a></li>'
      + '<li><a href="/dev"><span>Dev</span> <b>Build Something</b></a></li></ul>'
      + '<a href="https://linkedin.com/in/x" title="LinkedIn">x</a><span aria-hidden="true">&rarr;</span></body>';
    const r = await readPage(built, d);
    assert.deepEqual(r.undeclared.map((x) => x.text), []);
    assert.equal(r.counts.total, 7);
  });
});

// ----------------------------------------------------------- migration ---

const ASTRO = '<a href="/" title="Tom &amp; Jerry">Next &rarr;</a>\n<p>Plain &amp; simple</p>\n';
const legacyLedger = () => ({
  version: 1, strict: false, retired: [],
  baseline: [idFor('Tom &amp; Jerry')],
  entries: [
    // As 0.3 recorded them: &rarr; was not on its list, and Astro left
    // attributes as typed.
    {
      id: idFor('Next &rarr;'), text: 'Next &rarr;', words: 1, tier: 'label', status: 'human',
      authorship: { kind: 'written' }, note: 'mine', replacement: null, previous_ai_text: 'Continue &rarr;',
      occurrences: [{ file: 'src/a.astro', line: 1, kind: 'jsx-text', raw: 'Next &rarr;', quote: null }],
    },
    {
      id: idFor('Tom &amp; Jerry'), text: 'Tom &amp; Jerry', words: 3, tier: 'label', status: 'unreviewed',
      replacement: null, note: null,
      occurrences: [{ file: 'src/a.astro', line: 1, kind: 'jsx-attr:title', raw: 'Tom &amp; Jerry', quote: '"' }],
    },
    {
      id: idFor('Plain & simple'), text: 'Plain & simple', words: 2, tier: 'label', status: 'ai-fine',
      replacement: null, note: null,
      occurrences: [{ file: 'src/a.astro', line: 2, kind: 'jsx-text', raw: 'Plain &amp; simple', quote: null }],
    },
  ],
});

test('a ledger from before keeps its decisions under the decoded IDs', async () => {
  await withProject({ 'src/a.astro': ASTRO }, (project, dir) => {
    fs.mkdirSync(path.join(dir, 'copy'));
    fs.writeFileSync(project.ledgerPath, JSON.stringify(legacyLedger(), null, 2));
    const onDisk = load(project);
    const { ledger, added } = sync(project, onDisk);
    assert.deepEqual(added, [], 'nothing comes up as new');
    assert.deepEqual(ledger.retired, [], 'nothing is orphaned');

    const next = ledger.entries.find((e) => e.text === 'Next →');
    assert.equal(next.id, idFor('Next →'));
    assert.equal(next.status, 'human');
    assert.deepEqual(next.authorship, { kind: 'written' });
    assert.equal(next.note, 'mine');
    assert.equal(next.previous_ai_text, 'Continue &rarr;', 'the draft is kept as it was recorded');
    assert.equal(ledger.entries.find((e) => e.text === 'Plain & simple').status, 'ai-fine', 'already decoded: untouched');

    // Baseline debt follows its string, so check still passes.
    assert.deepEqual(ledger.baseline, [idFor('Tom & Jerry')]);
    assert.deepEqual(gate(onDisk, ledger).unledgered, []);

    save(project, ledger);
    const again = sync(project, load(project));
    assert.equal(again.added.length, 0);
    assert.deepEqual(again.ledger, ledger, 'idempotent');
  });
});

test('an entry the old decoder cannot reproduce is left for sync, not guessed at', () => {
  const l = legacyLedger();
  // A raw that would not have given this text (a comment once sat inside it).
  l.entries[0].occurrences[0].raw = 'Next <!-- x --> &rarr;';
  const out = migrate(l);
  assert.equal(out.entries[0].text, 'Next &rarr;');
  assert.equal(migrate(out), out, 'and nothing else to do');
});
