// Message catalogs: JSON and YAML values, and Markdown frontmatter. The
// property that matters is the round trip: a replacement must land exactly
// where the original was and leave the file parseable.

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOne, extractEntries } from '../src/extract/index.js';
import { scanJson } from '../src/extract/json.js';
import { scanYaml } from '../src/extract/yaml.js';
import { writeback } from '../src/writeback.js';
import { withProject, read } from './helpers.js';

/** Mark every entry rewritten with `fn(text)`, apply, return the file. */
async function roundTrip(rel, content, fn) {
  return withProject({ [rel]: content }, (project, dir) => {
    const entries = extractEntries(project);
    for (const e of entries) { e.status = 'rewritten'; e.replacement = fn(e.text); }
    const r = writeback(project, { version: 1, entries, retired: [] }, { apply: true });
    return { after: read(dir, rel), result: r, entries };
  });
}

// ----------------------------------------------------------------- JSON ---

const JSON_SRC = JSON.stringify({
  $schema: 'https://example.com/schema.json',
  nav: { home: 'Home', about: 'About us' },
  cart: { items: '{count} items in your cart', removed: 'Removed "{name}" from your cart.' },
  errors: { code: 'ERR_NETWORK', color: '#1a5f3f', enabled: true },
  links: ['Privacy', 'Terms'],
}, null, 2);

test('JSON: values are copy, keys and non-copy values are not', () => {
  const hits = extractOne('en.json', 'json', JSON_SRC);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('Home'));
  assert.ok(texts.includes('About us'));
  assert.ok(texts.includes('{count} items in your cart'));
  assert.ok(texts.includes('Removed "{name}" from your cart.'), 'escaped quotes decoded for display');
  assert.ok(texts.includes('Privacy'));
  assert.ok(!texts.includes('nav'), 'a key was claimed');
  assert.ok(!texts.some((t) => t.startsWith('https://')), 'a URL was claimed');
  assert.ok(!texts.includes('ERR_NETWORK'));
  assert.ok(!texts.includes('#1a5f3f'));
});

test('JSON: key paths are recorded for context', () => {
  const s = scanJson(JSON_SRC);
  assert.equal(s.find((x) => x.text === 'About us').at, 'nav.about');
  assert.equal(s.find((x) => x.text === 'Terms').at, 'links[1]');
});

test('JSON: a rewrite round-trips and the file still parses', async () => {
  const { after } = await roundTrip('en.json', JSON_SRC, (t) => `${t} — "quoted" \\ done`);
  const parsed = JSON.parse(after);
  assert.equal(parsed.nav.home, 'Home — "quoted" \\ done');
  assert.equal(parsed.cart.removed, 'Removed "{name}" from your cart. — "quoted" \\ done');
  assert.equal(parsed.errors.code, 'ERR_NETWORK', 'a non-copy value was touched');
});

// ----------------------------------------------------------------- YAML ---

const YAML_SRC = [
  '# a comment',
  'en:',
  '  hello: Hello there   # trailing comment',
  '  account:',
  '    title: "Your account"',
  "    signed_in: 'Signed in as %{name}'",
  '    warning: This continues',
  '      onto a second line.',
  '    empty: ~',
  '    flow: [one, two]',
  '    url: https://example.com/terms',
  '    enabled: true',
  '  body: |',
  '    Thanks for signing up.',
  '',
  '    Bring anything in on a Saturday.',
  '  after: Next key',
  '  steps:',
  '    - Pick a tool',
  '    - "Tell us how"',
  '    - name: Wait',
  '      hint: We ship on Tuesdays.',
  '',
].join('\n');

test('YAML: plain, quoted, block and sequence scalars are found; the rest is skipped', () => {
  const s = scanYaml(YAML_SRC);
  const byText = Object.fromEntries(s.map((x) => [x.text, x]));
  assert.equal(byText['Hello there'].kind, 'yaml-plain');
  assert.equal(byText['Hello there'].at, 'en.hello');
  assert.equal(byText['Your account'].kind, 'yaml-quoted');
  assert.equal(byText['Your account'].quote, '"');
  assert.equal(byText['Signed in as %{name}'].quote, "'");
  assert.equal(byText['This continues onto a second line.'].raw, 'This continues\n      onto a second line.');
  assert.equal(byText['Thanks for signing up.\n\nBring anything in on a Saturday.'].kind, 'yaml-block');
  assert.equal(byText['Next key'].at, 'en.after');
  assert.equal(byText['Pick a tool'].at, 'en.steps[]');
  assert.equal(byText['We ship on Tuesdays.'].at, 'en.steps[].hint');
  // The scanner reports every scalar; the extractor applies the copy filter.
  const texts = extractOne('en.yml', 'yaml', YAML_SRC).map((h) => h.text);
  assert.ok(texts.includes('Hello there'));
  assert.ok(!texts.includes('~'));
  assert.ok(!texts.some((t) => t.startsWith('[one')));
  assert.ok(!texts.some((t) => t.startsWith('https://')));
  assert.ok(!texts.includes('true'));
  assert.ok(!texts.includes('a comment'));
});

test('YAML: every raw is an exact substring at its recorded index', () => {
  for (const s of scanYaml(YAML_SRC)) {
    assert.equal(YAML_SRC.slice(s.index, s.index + s.raw.length), s.raw, `index off for ${s.text}`);
  }
});

test('YAML: rewrites round-trip, quoting where the new text needs it', async () => {
  const { after, result } = await roundTrip('en.yml', YAML_SRC, (t) => {
    if (t === 'Hello there') return 'Hi: there #not a comment';    // needs quotes
    if (t === 'Your account') return 'Your "account"';
    if (t === 'Signed in as %{name}') return "You're in, %{name}";
    if (t.startsWith('Thanks')) return 'Line one.\n\nLine two, indented the same.';
    return t;
  });
  assert.equal(result.blocked.length, 0, JSON.stringify(result.blocked.map((b) => b.reason)));
  assert.match(after, /hello: "Hi: there #not a comment"/);
  assert.match(after, /title: "Your \\"account\\""/);
  assert.match(after, /signed_in: 'You''re in, %\{name\}'/);
  assert.match(after, /body: \|\n    Line one\.\n    \n    Line two, indented the same\.\n  after:/);
  assert.match(after, /enabled: true/);
});

// ----------------------------------------------------------- frontmatter ---

test('Markdown frontmatter values are copy, and the fence is not a paragraph', () => {
  const src = '---\ntitle: About Northwind\ndescription: "A small shop, since 1987."\ntags: [a, b]\n---\n\n# About\n\nWe make chisels.\n';
  const hits = extractOne('about.md', 'md', src);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('About Northwind'));
  assert.ok(texts.includes('A small shop, since 1987.'));
  assert.ok(texts.includes('# About'));
  assert.ok(texts.includes('We make chisels.'));
  assert.ok(!texts.some((t) => t.includes('---')));
  assert.equal(hits.find((h) => h.text === 'About Northwind').line, 2);
});
