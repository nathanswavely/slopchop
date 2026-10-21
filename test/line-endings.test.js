// Writeback keeps each file's line endings, and its trailing newline or the
// lack of one, whatever the machine or the text that came in.

import assert from 'node:assert/strict';
import test from 'node:test';
import { writeback } from '../src/writeback.js';
import { sync, load, decide } from '../src/ledger.js';
import { withProject, read } from './helpers.js';

function rewrite(project, pairs) {
  const { ledger } = sync(project, load(project));
  for (const [from, to] of pairs) {
    const e = ledger.entries.find((x) => x.text === from);
    assert.ok(e, `no entry for ${from}`);
    decide(e, { status: 'rewritten', replacement: to });
  }
  const r = writeback(project, ledger, { apply: true });
  assert.deepEqual(r.blocked.map((b) => b.reason), []);
  return r;
}

test('an LF JSON file stays LF, with its trailing newline', async () => {
  const json = '{\n  "projects": [\n    { "title": "Barn", "blurb": "A barn we restored with a lot of care." }\n  ]\n}\n';
  await withProject({ 'src/data/projects.json': json }, (project, dir) => {
    rewrite(project, [['A barn we restored with a lot of care.', 'We fixed a barn.\r\nIt took a year.']]);
    const out = read(dir, 'src/data/projects.json');
    assert.ok(!out.includes('\r'), 'no CR anywhere');
    assert.equal(out, json.replace('A barn we restored with a lot of care.', 'We fixed a barn.\\nIt took a year.'));
  });
});

test('line breaks in a rewrite are written the way the file writes them', async () => {
  const lf = '# Title\n\nOne paragraph a model wrote for the page.\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  await withProject({ 'lf.md': lf, 'crlf.md': crlf }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    for (const e of ledger.entries.filter((x) => x.text.startsWith('One paragraph'))) {
      decide(e, { status: 'rewritten', replacement: 'Two short lines,\r\nnow mine.\n\nAnd a second paragraph.' });
    }
    writeback(project, ledger, { apply: true });

    assert.equal(read(dir, 'lf.md'), '# Title\n\nTwo short lines,\nnow mine.\n\nAnd a second paragraph.\n');
    assert.equal(read(dir, 'crlf.md'), '# Title\r\n\r\nTwo short lines,\r\nnow mine.\r\n\r\nAnd a second paragraph.\r\n');
  });
});

test('a file with no trailing newline is left without one', async () => {
  await withProject({ 'a.md': 'One paragraph a model wrote for the page.' }, (project, dir) => {
    rewrite(project, [['One paragraph a model wrote for the page.', 'Mine, with a break after.\n']]);
    assert.equal(read(dir, 'a.md'), 'Mine, with a break after.');
  });
});

test('a CRLF YAML block, recorded with LF, is still found and keeps CRLF', async () => {
  const yaml = 'intro: |\r\n  A block a model wrote,\r\n  over two lines.\r\nother: Plain value a model wrote here\r\n';
  await withProject({ 'en.yml': yaml }, (project, dir) => {
    const { ledger } = sync(project, load(project));
    const block = ledger.entries.find((e) => e.occurrences[0].kind === 'yaml-block');
    assert.ok(block);
    decide(block, { status: 'rewritten', replacement: 'Mine,\nover two lines too.' });
    const r = writeback(project, ledger, { apply: true });
    assert.deepEqual(r.blocked, []);
    assert.equal(read(dir, 'en.yml'), 'intro: |\r\n  Mine,\r\n  over two lines too.\r\nother: Plain value a model wrote here\r\n');
  });
});
