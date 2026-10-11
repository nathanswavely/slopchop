// Astro components: frontmatter, template, expressions, client scripts.

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOne, extractEntries } from '../src/extract/index.js';
import { writeback } from '../src/writeback.js';
import { langFor } from '../src/config.js';
import { withProject, read } from './helpers.js';

const ASTRO = [
  '---',
  "import Card from '../components/Card.astro';",
  "import { bands } from '../data/bands';",
  "const empty = 'Nothing is booked right now, check back soon.';",
  'const upcoming = bands.filter((b) => b.events.length > 0);',
  '---',
  '',
  '<section class="shows" aria-label="Upcoming shows">',
  '  <!-- Comment copy is not copy. -->',
  '  {/* Neither is a JSX comment. */}',
  "  <h2>{upcoming.length ? 'Upcoming shows' : 'Recently played'}</h2>",
  '  <p class="intro">Bands, an author, and a few companies &amp; friends.</p>',
  '  <ul>',
  '    {upcoming.map((band) => (',
  '      <li class="band-row">',
  '        <img src={band.image} alt="Band photo from the last show" />',
  '        <span class="band-name">{band.name}</span>',
  '        <span class="view">View band</span>',
  '      </li>',
  '    ))}',
  '  </ul>',
  "  {upcoming.length === 0 && <p>{empty}</p>}",
  '  {icon ? (<svg><path d={icon} /></svg>) : icon?.path ? (<svg><path d={icon.path} /></svg>) : null}',
  '  <a href="/">&larr;</a>',
  '  <p>If you\'re looking to make something sound better, let\'s talk.</p>',
  '</section>',
  '',
  '<script>',
  "  const sorry = 'Sorry, that link did not load.';",
  "  document.querySelector('.band-row')?.classList.add('ready');",
  '</script>',
  '',
  '<style>',
  "  .view::after { content: 'Not copy either'; }",
  '</style>',
].join('\n');

test('Astro: .astro files map to the Astro extractor', () => {
  assert.equal(langFor('src/pages/index.astro'), 'astro');
});

test('Astro: frontmatter, template, expressions and client scripts; not imports, comments or style', () => {
  const hits = extractOne('Shows.astro', 'astro', ASTRO);
  const texts = hits.map((h) => h.text);

  assert.ok(texts.includes('Nothing is booked right now, check back soon.'), 'frontmatter string');
  assert.ok(texts.includes('Upcoming shows'), 'aria-label and the expression string, one text');
  assert.ok(texts.includes('Recently played'), 'other branch of the ternary');
  assert.ok(texts.includes('Bands, an author, and a few companies & friends.'), 'entity decoded for review');
  assert.ok(texts.includes('Band photo from the last show'), 'alt text');
  assert.ok(texts.includes('View band'), 'text inside a map callback');
  assert.ok(texts.includes("If you're looking to make something sound better, let's talk."), 'apostrophes stay in one text node');
  assert.ok(texts.includes('Sorry, that link did not load.'), 'client script string');

  assert.ok(!texts.some((t) => t.includes('../')), 'import paths');
  assert.ok(!texts.some((t) => /copy/i.test(t) && /not/i.test(t) && !t.startsWith('Nothing')), 'comments and style');
  assert.ok(!texts.some((t) => t.includes('=>') || t.includes('band.')), 'arrow functions and member access');
  assert.ok(!texts.some((t) => t.startsWith('re looking') || t.startsWith('s talk')), 'no fake strings from apostrophes');
  assert.ok(!texts.some((t) => t.includes('?.') || t.startsWith(')')), 'ternary residue between two branches');
  assert.ok(!texts.some((t) => t.includes('&larr;') || t === '←'), 'an arrow entity on its own');

  for (const h of hits) assert.ok(ASTRO.includes(h.raw), `not in source: ${h.raw}`);
});

test('Astro: a file without frontmatter still extracts, and a later --- is not a fence', () => {
  const src = '<p>First paragraph of the page.</p>\n---\n<p>Second one, after a rule.</p>\n';
  const texts = extractOne('Plain.astro', 'astro', src).map((h) => h.text);
  assert.ok(texts.includes('First paragraph of the page.'));
  assert.ok(texts.includes('Second one, after a rule.'));
});

test('Astro: a rewrite lands in the template, the frontmatter, and the expression', async () => {
  await withProject({ 'src/Shows.astro': ASTRO }, (project, dir) => {
    const entries = extractEntries(project);
    const set = (text, replacement) => {
      const e = entries.find((x) => x.text === text);
      assert.ok(e, `no entry for ${text}`);
      e.status = 'rewritten';
      e.replacement = replacement;
    };
    set('View band', 'See the band');
    set('Nothing is booked right now, check back soon.', "Nothing's booked right now.");
    set('Recently played', 'Last few shows');

    const r = writeback(project, { version: 1, entries, retired: [] }, { apply: true });
    assert.equal(r.blocked.length, 0);
    const after = read(dir, 'src/Shows.astro');
    assert.match(after, /<span class="view">See the band<\/span>/);
    assert.match(after, /const empty = 'Nothing\\'s booked right now\.';/);
    assert.match(after, /\? 'Upcoming shows' : 'Last few shows'\}/);
    assert.match(after, /<style>[\s\S]*Not copy either/, 'style untouched');
  });
});

test('Astro: template text refuses a brace rather than opening an expression', async () => {
  await withProject({ 'src/Shows.astro': ASTRO }, (project) => {
    const entries = extractEntries(project);
    const e = entries.find((x) => x.text === 'View band');
    e.status = 'rewritten';
    e.replacement = 'See {the} band';
    const r = writeback(project, { version: 1, entries, retired: [] }, { apply: false });
    assert.equal(r.blocked.length, 1);
  });
});
