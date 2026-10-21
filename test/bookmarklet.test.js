// The bookmarklet: the same Reader, bundled into one javascript: URL.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { bundleModules, bookmarkletSource, bookmarkletUrl } from '../src/bundle.js';
import { readPage } from '../src/reader.js';
import { slopId } from '../src/slop.js';

const load = (entry) => new Function(`const m = {};\n${bundleModules(entry)}\nreturn m;`)();
const INDEX = fs.readFileSync(new URL('../examples/site/src/index.html', import.meta.url), 'utf8');

test('the bundled Reader gives the same answer as the one in Node', async () => {
  const m = load('reader.js');
  assert.deepEqual(Object.keys(m), ['expressions.js', 'extract/common.js', 'extract/js.js', 'extract/html.js', 'slop.js', 'reader.js']);
  const d = {
    slop: 1, declarant: 'Pat', contact: 'pat@example.com', outOfScope: ['Fixtures.'],
    copy: { [await slopId('Keep me posted')]: 'human+', [await slopId('Northwind Tools')]: 'not-copy' },
  };
  assert.deepEqual(await m['reader.js'].readPage(INDEX, d), await readPage(INDEX, d));
  assert.equal(await m['slop.js'].slopId('hello world'), 'b94d27b9934d');
});

test('the bookmarklet is one self-contained javascript: URL', () => {
  const url = bookmarkletUrl();
  assert.ok(url.startsWith('javascript:'));
  assert.equal(decodeURIComponent(url.slice('javascript:'.length)), bookmarkletSource());
  assert.doesNotThrow(() => new Function(bookmarkletSource()), 'it parses');
  assert.doesNotMatch(bookmarkletSource(), /\bimport\s*[{(]|\bexport\s|node:/);
  const m = load('bookmarklet.js');
  assert.equal(typeof m['bookmarklet.js'].run, 'function');
});

test('a module with a Node import is refused, not bundled', () => {
  assert.throws(() => bundleModules('disclosure.js'), /only named imports|cannot bundle/);
});
