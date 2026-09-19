// HTML, Vue templates, JSX and MDX: the markup family.

import assert from 'node:assert/strict';
import test from 'node:test';
import { extractOne, extractEntries } from '../src/extract/index.js';
import { encodeFor, writeback } from '../src/writeback.js';
import { withProject, read } from './helpers.js';

const HTML = [
  '<!doctype html>',
  '<html><head>',
  '  <title>Northwind Tools</title>',
  '  <meta name="description" content="Hand tools made in Lancaster &amp; sharpened for life.">',
  '  <meta name="viewport" content="width=device-width">',
  '  <style>body { font: 16px sans-serif; }</style>',
  '</head><body>',
  '  <!-- Comment copy is not copy. -->',
  '  <h1>Tools you&rsquo;ll hand down</h1>',
  '  <a href="/shop" title="Browse the shop">See the bench</a>',
  '  <input placeholder="Your email address">',
  '  {% if user %}<p>Welcome back, {{ user.name }}.</p>{% else %}<p>New here? Start with the gauge.</p>{% endif %}',
  '  <pre>make sharpen</pre>',
  '  <p>Call us at <code>555-0100</code> or just <!-- not this --> stop by.</p>',
  '  <button :title="tool.name" data-title="x" [title]="y" title="Static title">Add</button>',
  '  <script>console.log("Not copy.");</script>',
  '</body></html>',
].join('\n');

test('HTML: text nodes, copy attributes and meta descriptions; not script, style, comments or pre', () => {
  const hits = extractOne('index.html', 'html', HTML);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('Northwind Tools'));
  assert.ok(texts.includes('Hand tools made in Lancaster & sharpened for life.'), 'meta description, decoded');
  assert.ok(texts.includes('Tools you’ll hand down'), 'entity decoded for review');
  assert.ok(texts.includes('Browse the shop'));
  assert.ok(texts.includes('Your email address'));
  assert.ok(texts.includes('Welcome back, {{ user.name }}.'), 'interpolation stays in the copy');
  assert.ok(texts.includes('New here? Start with the gauge.'), 'the other branch of a Liquid conditional');
  assert.ok(texts.includes('Call us at'), 'the fragment before inline code');
  assert.ok(texts.includes('or just stop by.'), 'the fragment after it, comment removed from the reviewed text');
  assert.ok(!texts.includes('make sharpen'));
  assert.ok(!texts.includes('555-0100'));
  assert.ok(!texts.some((t) => t.includes('Not copy')));
  assert.ok(!texts.some((t) => t.includes('Comment copy')));
  assert.ok(!texts.some((t) => t.includes('width=device-width')));
  assert.ok(!texts.some((t) => /\{%/.test(t)));
});

test('HTML: bound attributes are not copy; the static one beside them is', () => {
  const attrs = extractOne('index.html', 'html', HTML).filter((h) => h.kind === 'html-attr:title').map((h) => h.text);
  assert.deepEqual(attrs, ['Browse the shop', 'Static title']);
});

test('HTML: raw is always a verbatim substring of the source, comments and entities included', () => {
  const hits = extractOne('index.html', 'html', HTML);
  const h = hits.find((h) => h.text.startsWith('Tools you'));
  assert.equal(h.raw, 'Tools you&rsquo;ll hand down');
  const c = hits.find((h) => h.text === 'or just stop by.');
  assert.equal(c.raw, 'or just <!-- not this --> stop by.');
  for (const x of hits) assert.ok(HTML.includes(x.raw), `not in source: ${x.raw}`);
});

test('HTML: a rewrite is re-encoded on the way back in', async () => {
  await withProject({ 'index.html': HTML }, (project, dir) => {
    const entries = extractEntries(project);
    const h1 = entries.find((e) => e.text.startsWith('Tools you'));
    h1.status = 'rewritten'; h1.replacement = 'Chisels & gauges <3 you';
    const meta = entries.find((e) => e.text.startsWith('Hand tools'));
    meta.status = 'rewritten'; meta.replacement = 'Made in "Lancaster" & shipped';
    const r = writeback(project, { version: 1, entries, retired: [] }, { apply: true });
    assert.equal(r.blocked.length, 0);
    const after = read(dir, 'index.html');
    assert.match(after, /<h1>Chisels &amp; gauges &lt;3 you<\/h1>/);
    assert.match(after, /content="Made in &quot;Lancaster&quot; &amp; shipped"/);
    assert.match(after, /<script>console\.log\("Not copy\."\);<\/script>/, 'script untouched');
  });
});

// ------------------------------------------------------------------- Vue ---

test('Vue: template text and attributes, plus script strings', () => {
  const src = '<template>\n  <p v-if="ok">Ships Tuesday. Sharpened first.</p>\n  <button aria-label="Add to cart">Add</button>\n</template>\n<script setup>\nconst SOLD = "Sorry, that one just sold out.";\n</script>\n<style>.a{}</style>';
  const hits = extractOne('Card.vue', 'vue', src);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('Ships Tuesday. Sharpened first.'));
  assert.ok(texts.includes('Add to cart'));
  assert.ok(texts.includes('Sorry, that one just sold out.'));
  assert.ok(!texts.some((t) => t.includes('.a{}')));
});

// ------------------------------------------------------------------- JSX ---

const JSX = [
  "import { useState } from 'react';",
  'export function Hero({ count }) {',
  "  const label = count > 0 ? 'Cart' : 'Empty cart';",
  '  if (count < 0) return null;',
  '  return (',
  '    <section>',
  '      <h2>Made to be repaired, not replaced.</h2>',
  '      <p>',
  '        Bring it back and we will fix it. {count} people did this year.',
  '      </p>',
  '      <button onClick={() => go()} title="Open your cart">{label}</button>',
  '      <img alt="The workbench on a Saturday" />',
  '      {open && <Cart onClose={() => toast("Your cart has been saved for later.")} />}',
  '    </section>',
  '  );',
  '}',
].join('\n');

test('JSX: text between tags, copy attributes, and prose strings; not operators', () => {
  const hits = extractOne('Hero.jsx', 'jsx', JSX);
  const texts = hits.map((h) => h.text);
  assert.ok(texts.includes('Made to be repaired, not replaced.'));
  assert.ok(texts.includes('Bring it back and we will fix it. {count} people did this year.'));
  assert.ok(texts.includes('Open your cart'));
  assert.ok(texts.includes('The workbench on a Saturday'));
  assert.ok(texts.includes('Your cart has been saved for later.'));
  for (const t of texts) {
    assert.ok(!/return null|count </.test(t), `operator soup filed as copy: ${t}`);
  }
  assert.equal(hits.find((h) => h.text === 'Your cart has been saved for later.').kind, 'jsx-string');
});

test('JSX: writeback refuses what JSX cannot hold instead of guessing', () => {
  assert.ok(encodeFor('jsx-text', null, 'Use {braces}').problem);
  assert.ok(encodeFor('jsx-text', null, 'a < b').problem);
  assert.equal(encodeFor('jsx-text', null, "Don't stop & go").value, "Don't stop & go");
  assert.ok(encodeFor('jsx-string', '"', 'He said "hi"').problem);
  assert.equal(encodeFor('jsx-attr:title', '"', "Nathan's cart").value, "Nathan's cart");
});

// ------------------------------------------------------------------- MDX ---

test('MDX: imports, exports and expressions are skipped; component text is copy', () => {
  const src = [
    "import { Callout } from '../components/Callout'",
    'export const meta = {',
    "  title: 'Pricing',",
    '}',
    '',
    '# Pricing',
    '',
    'No tiers, no bundles.',
    '',
    '<Callout kind="info">',
    '  Sharpening is free for anything we made.',
    '</Callout>',
    '',
    '{meta.title}',
    '',
  ].join('\n');
  const hits = extractOne('pricing.mdx', 'mdx', src);
  const texts = hits.map((h) => h.text);
  assert.deepEqual(texts, ['# Pricing', 'No tiers, no bundles.', 'Sharpening is free for anything we made.']);
  assert.equal(hits[2].kind, 'html-text');
  assert.equal(hits[2].line, 11);
});
