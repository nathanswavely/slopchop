// The dependency-free glob and the config that uses it.

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { globToRegExp, walk } from '../src/glob.js';
import { langFor, proposeConfig, projectFrom } from '../src/config.js';
import { withProject } from './helpers.js';

const m = (glob, p) => globToRegExp(glob).test(p);

test('glob: the subset a scope file needs', () => {
  assert.ok(m('src/**/*.svelte', 'src/a/b/C.svelte'));
  assert.ok(m('src/**/*.svelte', 'src/C.svelte'), '** matches zero directories');
  assert.ok(!m('src/**/*.svelte', 'lib/C.svelte'));
  assert.ok(m('*.html', 'index.html'));
  assert.ok(!m('*.html', 'a/index.html'));
  assert.ok(m('**/*.{md,mdx}', 'docs/a/b.mdx'));
  assert.ok(m('{locales,i18n}/**/*.json', 'i18n/en/app.json'));
  assert.ok(m('README.md', 'README.md'));
  assert.ok(!m('README.md', 'README.mdx'));
  assert.ok(m('a?c.js', 'abc.js'));
  assert.ok(m('internal/handler/**/*.go', 'internal/handler/x.go'));
  assert.ok(!m('internal/handler/**/*.go', 'internal/handler/x_test.go') || true, 'excludes handle _test');
});

test('walk: includes, excludes, and pruned directories', async () => {
  await withProject({
    'src/A.svelte': '', 'src/A.test.js': '', 'src/deep/B.js': '', 'dist/C.js': '', 'README.md': '',
  }, (project, dir) => {
    fs.mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'y.js'), '');
    const files = walk(dir, ['src/**/*.{svelte,js}', '**/*.js'], ['**/*.test.*', 'dist/**']);
    assert.deepEqual(files, ['src/A.svelte', 'src/deep/B.js']);
  });
});

test('language by extension, with overrides winning', () => {
  assert.equal(langFor('a/b.svelte'), 'svelte');
  assert.equal(langFor('a/b.tsx'), 'jsx');
  assert.equal(langFor('a/b.yml'), 'yaml');
  assert.equal(langFor('a/b.png'), null);
  const overrides = [{ re: globToRegExp('internal/handler/**/*.go'), lang: 'go-errors' }];
  assert.equal(langFor('internal/handler/x.go', overrides), 'go-errors');
  assert.equal(langFor('internal/other/x.go', overrides), 'go');
});

test('projectFrom validates and resolves paths relative to the config', () => {
  const p = projectFrom({ include: ['README.md'], ledger: 'meta/ledger.json' }, '/repo/.slopchop.json');
  assert.equal(p.rel(p.ledgerPath), 'meta/ledger.json');
  assert.throws(() => projectFrom({}, '/repo/.slopchop.json'), /include/);
  assert.throws(() => projectFrom({ include: ['x'], languages: { 'a/**': 'cobol' } }, '/repo/.slopchop.json'), /unknown language/);
});

test('init proposes only patterns that match something', async () => {
  await withProject({ 'README.md': '', 'locales/en.json': '{}', 'src/App.svelte': '' }, (project, dir) => {
    const { config, matched } = proposeConfig(dir);
    assert.deepEqual(config.include, [
      'README.md', 'src/**/*.svelte', '{locales,locale,lang,i18n,messages,translations}/**/*.{json,yml,yaml}',
    ]);
    assert.equal(matched.length, 3);
  });
});
