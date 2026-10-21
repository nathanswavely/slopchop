// The `slop: 1` ID: a frozen public spec, defined apart from the ledger's.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { slopId, slopText, formatStatus, parseStatus, SLOP_VERSION } from '../src/slop.js';
import { idFor } from '../src/extract/index.js';

test('slop: 1 is the first 12 hex of SHA-256 over the collapsed, trimmed UTF-8 text', async () => {
  assert.equal(SLOP_VERSION, 1);
  // sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
  assert.equal(await slopId('hello world'), 'b94d27b9934d');
  assert.equal(await slopId('  hello \n\t  world\n'), 'b94d27b9934d');
  assert.equal(slopText(' a  b \n c '), 'a b c');
  // UTF-8, not UTF-16: sha256("café") = 850f7dc43910ff890f8879c0ed26fe697c93a067ad93a7d50f466a7028a9bf4e
  assert.equal(await slopId('café'), '850f7dc43910');
});

test('slop: 1 does not normalize Unicode', async () => {
  const composed = 'café', decomposed = 'café';
  assert.notEqual(await slopId(composed), await slopId(decomposed));
});

test('slop: 1 agrees with the ledger ID today, on every string in the example ledger', async () => {
  const ledger = JSON.parse(fs.readFileSync(new URL('../examples/site/copy/ledger.json', import.meta.url), 'utf8'));
  for (const e of ledger.entries) {
    assert.equal(await slopId(e.text), idFor(e.text), e.text);
    assert.equal(await slopId(e.text), e.id, e.text);
  }
});

test('a + on a status says a draft was replaced', () => {
  assert.equal(formatStatus('human', true), 'human+');
  assert.equal(formatStatus('ai-fine', false), 'ai-fine');
  assert.deepEqual(parseStatus('ai-revised+'), { status: 'ai-revised', replaced: true });
  assert.deepEqual(parseStatus('not-copy'), { status: 'not-copy', replaced: false });
});
