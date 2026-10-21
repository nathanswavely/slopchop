// The Reader: a live page, hashed and looked up in a copy disclosure.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pageStrings, readPage, checkDisclosure, disclosureUrl, describeStatus } from '../src/reader.js';
import { extractHtml } from '../src/extract/html.js';
import { slopId } from '../src/slop.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = path.join(ROOT, 'examples/site');
const INDEX = fs.readFileSync(path.join(EXAMPLE, 'src/index.html'), 'utf8');

const disclosure = async (map, extra = {}) => {
  const copy = {};
  for (const [text, status] of Object.entries(map)) copy[await slopId(text)] = status;
  return { slop: 1, declarant: 'Pat Example', contact: 'pat@example.com', generated: '2026-10-20', statement: 'Self-reported.', outOfScope: [], copy, ...extra };
};

test('a page has the strings sync would find in it', () => {
  const fromSync = new Set(extractHtml('src/index.html', INDEX).map((h) => h.text));
  const fromPage = pageStrings(INDEX);
  assert.deepEqual(new Set(fromPage.map((s) => s.text)), fromSync);
  assert.deepEqual(fromPage.find((s) => s.text === 'Northwind Tools'), { text: 'Northwind Tools', where: ['text', 'meta og:title'], count: 2 });
  assert.deepEqual(fromPage.find((s) => s.text === 'Your email address').where, ['placeholder']);
  // Entities decoded, as the DOM gives them.
  assert.ok(fromPage.some((s) => s.text === 'Tools you’ll hand down'));
});

test('declared copy carries its status; undeclared copy is listed by its text', async () => {
  const d = await disclosure({
    'Tools you’ll hand down': 'human+',
    'Keep me posted': 'human',
    'Your email address': 'ai-fine',
    'Northwind Tools': 'not-copy',
    'Text that is on some other page': 'human',
  }, { outOfScope: ['Translations follow the English.'] });
  const r = await readPage(INDEX, d);

  assert.equal(r.declarant, 'Pat Example');
  assert.deepEqual(r.outOfScope, ['Translations follow the English.']);
  assert.deepEqual(r.declared.map((x) => [x.text, x.status]), [
    ['Northwind Tools', 'not-copy'],
    ['Tools you’ll hand down', 'human+'],
    ['Your email address', 'ai-fine'],
    ['Keep me posted', 'human'],
  ], 'in page order');
  const hand = r.declared.find((x) => x.status === 'human+');
  assert.equal(hand.base, 'human');
  assert.equal(hand.replaced, true);
  assert.equal(hand.id, await slopId('Tools you’ll hand down'));

  // 13 strings on the page; not-copy is out of the denominator.
  assert.equal(r.undeclared.length, 9);
  assert.ok(r.undeclared.some((u) => u.text === 'We make a few things well. Chisels, gauges, mallets. Everything is sharpened before it ships and sharpened again whenever you like.'));
  assert.deepEqual(r.counts, {
    total: 12, declared: 3, undeclared: 9, notCopy: 1,
    byStatus: { 'not-copy': 1, 'human+': 1, 'ai-fine': 1, human: 1 },
  });
});

test('a template string never matches the page it renders into', async () => {
  const d = await disclosure({ 'Welcome back, {{ user.name }}.': 'human' });
  const r = await readPage('<p>Welcome back, Robin.</p>', d);
  assert.deepEqual(r.declared, []);
  assert.deepEqual(r.undeclared.map((u) => u.text), ['Welcome back, Robin.']);
});

test('whitespace on the page does not matter; markup splits strings the way sync does', async () => {
  const d = await disclosure({ 'Call us at': 'human', 'or just stop by.': 'ai-fine' });
  const r = await readPage('<p>\n  Call   us at\n  <code>555-0100</code> or just\n  stop by.</p>', d);
  assert.equal(r.counts.declared, 2);
  assert.equal(r.counts.undeclared, 0);
});

test('a Document or an Element reads the same as its markup', async () => {
  const d = await disclosure({ 'Keep me posted': 'human' });
  const a = await readPage(INDEX, d);
  const b = await readPage({ documentElement: { outerHTML: INDEX } }, d);
  assert.deepEqual(a, b);
  await assert.rejects(readPage(42, d), /takes page HTML/);
});

test('only slop: 1 is read', async () => {
  assert.throws(() => checkDisclosure({ slop: 2, copy: {} }), /version 2; this Reader reads slop: 1/);
  assert.throws(() => checkDisclosure({ copy: {} }), /version undefined/);
  assert.throws(() => checkDisclosure({ slop: 1 }), /"copy" must map/);
  assert.throws(() => checkDisclosure([]), /JSON object/);
  assert.doesNotThrow(() => checkDisclosure({ slop: 1, copy: {} }));
});

test('the disclosure lives at /slop.json on the page\'s origin', () => {
  assert.equal(disclosureUrl('https://example.com/about/team?x=1#y'), 'https://example.com/slop.json');
  assert.equal(disclosureUrl('http://localhost:4321/'), 'http://localhost:4321/slop.json');
});

test('statuses read as the ledger means them', () => {
  assert.equal(describeStatus('human'), 'written by a person');
  assert.equal(describeStatus('human+'), 'written by a person, replacing a draft');
  assert.equal(describeStatus('ai-fine'), 'left as a model drafted it');
  assert.equal(describeStatus('something-else'), 'something-else');
});

// ---------------------------------------------- report, then read, end to end ---

const cli = (cwd, ...args) => execFileSync(process.execPath, [path.join(ROOT, 'bin/slopchop.js'), ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
});

test('report then read against the example site', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slopchop-site-'));
  try {
    fs.cpSync(EXAMPLE, dir, { recursive: true });
    const configPath = path.join(dir, '.slopchop.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const ledgerPath = path.join(dir, 'copy/ledger.json');
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const set = (text, status, extra = {}) => Object.assign(ledger.entries.find((e) => e.text === text), { status, ...extra });
    set('Tools you’ll hand down', 'human', { previous_ai_text: 'Tools for generations' });
    set('Keep me posted', 'ai-fine');
    set('Your email address', 'ai-fine');
    set('Email address', 'ai-fine');
    set('Northwind Tools', 'not-copy');
    set('Browse the shop', 'rewritten', { replacement: 'Into the shop' });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

    // No block: report writes no disclosure.
    assert.doesNotMatch(cli(dir, 'report'), /slop\.json/);
    assert.ok(!fs.existsSync(path.join(dir, 'public/slop.json')));

    config.disclosure = { enabled: true, path: 'public/slop.json', declarant: 'Northwind Tools', contact: 'hello@example.com' };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    assert.match(cli(dir, 'report'), /wrote public\/slop\.json \(copy disclosure: 5 IDs/);

    const r = JSON.parse(cli(dir, 'read', 'src/index.html', '--json'));
    assert.equal(r.declarant, 'Northwind Tools');
    assert.deepEqual(r.outOfScope, ['Translations follow the English; review the source language.']);
    assert.deepEqual(r.counts, {
      total: 12, declared: 4, undeclared: 8, notCopy: 1,
      byStatus: { 'not-copy': 1, 'human+': 1, 'ai-fine': 3 },
    });
    // The pending rewrite is still on the page, and reads as undeclared.
    assert.ok(r.undeclared.some((u) => u.text === 'Browse the shop'));

    const human = cli(dir, 'read', 'src/index.html');
    assert.match(human, /4\/12 strings declared \(33%\) · 8 undeclared/);
    assert.match(human, /"Welcome back, \{\{ user\.name \}\}\."/);

    config.disclosure.enabled = false;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    assert.match(cli(dir, 'report'), /removed public\/slop\.json/);
    assert.ok(!fs.existsSync(path.join(dir, 'public/slop.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
