// What happens when the same file is decided on both review surfaces at once.
//
// The property under test is the one that makes divergence a papercut rather
// than data loss: a draft block nobody wrote in must never be pulled back over
// a decision made in the review UI since.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { idFor } from '../src/extract/index.js';
import { projectFrom } from '../src/config.js';
import {
  writeDrafts, pullDrafts, outstandingDrafts, draftHolding, pruneDrafts, rescueOrphans,
} from '../src/drafts.js';

// Each case gets its own draft directory, which is also a small proof that
// nothing assumes copy/drafts/.
async function withDrafts(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-drafts-'));
  try {
    const project = projectFrom(
      { include: ['README.md'], drafts: 'drafts' }, path.join(dir, '.slopchop.json'));
    return await fn(project, project.draftDir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const AI = 'A sentence some model produced for the front door of the site.';
const NOW_IN_SOURCE = 'The replacement a person wrote, now in source.';

const entry = (over = {}) => {
  const text = over.text ?? AI;
  return {
    id: idFor(text), text, words: text.split(/\s+/).length, tier: 'helper',
    status: 'unreviewed', replacement: null,
    occurrences: [{ file: 'README.md', line: 12, kind: 'md-block', raw: text }],
    ...over,
  };
};

const ledgerWith = (...entries) => ({ version: 1, entries, retired: [] });
const afterApply = () => ledgerWith(entry({ text: NOW_IN_SOURCE, status: 'human', previous_ai_text: AI }));

function editBlock(dir, source, id, body) {
  const p = path.join(dir, `${source}.md`);
  const src = fs.readFileSync(p, 'utf8');
  const re = new RegExp(`(<!-- copy:${id} -->\\n)[\\s\\S]*?(\\n<!-- end:${id} -->)`);
  fs.writeFileSync(p, src.replace(re, `$1${body}$2`));
}

test('an untouched draft never overwrites a decision made in the UI', async () => {
  await withDrafts((p) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    ledger.entries[0].status = 'rewritten';
    ledger.entries[0].replacement = 'Words a person wrote at the workbench.';
    const r = pullDrafts(p, ledger);
    assert.equal(r.unchanged, 1);
    assert.equal(r.recorded, 0);
    assert.equal(ledger.entries[0].replacement, 'Words a person wrote at the workbench.');
  });
});

test('a draft cut from a replacement does not reinstate it after the UI moves on', async () => {
  await withDrafts((p) => {
    const ledger = ledgerWith(entry({ status: 'rewritten', replacement: 'An early attempt, later abandoned.' }));
    writeDrafts(p, ledger);
    ledger.entries[0].status = 'human';
    ledger.entries[0].replacement = null;
    const r = pullDrafts(p, ledger);
    assert.equal(r.recorded, 0);
    assert.equal(ledger.entries[0].status, 'human');
  });
});

test('writing in a draft is pulled; @mine and @fine are decisions', async () => {
  await withDrafts((p, dir) => {
    const other = entry({ text: 'Another string entirely, longer than five words.',
      occurrences: [{ file: 'README.md', line: 30, kind: 'md-block', raw: 'x' }] });
    const third = entry({ text: 'A third string, mechanical and fine as it is.',
      occurrences: [{ file: 'README.md', line: 40, kind: 'md-block', raw: 'y' }] });
    const ledger = ledgerWith(entry(), other, third);
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, 'A sentence I wrote on a train.');
    editBlock(dir, 'README.md', other.id, '@mine');
    editBlock(dir, 'README.md', third.id, '@fine');
    const r = pullDrafts(p, ledger);
    assert.equal(r.recorded, 1);
    assert.equal(r.mine, 1);
    assert.equal(r.fine, 1);
    assert.equal(ledger.entries[0].replacement, 'A sentence I wrote on a train.');
    assert.equal(other.status, 'human');
    assert.equal(third.status, 'ai-fine');
  });
});

test('a stale marker is reported, never applied to another entry', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, 'Writing with nowhere to land.');
    const moved = afterApply();
    const r = pullDrafts(p, moved);
    assert.equal(r.unknown.length, 1);
    assert.equal(r.unknown[0].touched, true);
    assert.equal(moved.entries[0].status, 'human');
  });
});

test('an untouched stale marker is recognised even with no manifest', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    fs.rmSync(path.join(dir, '.rendered.json'));
    const [d] = outstandingDrafts(p, afterApply());
    assert.equal(d.stale.length, 1);
    assert.equal(d.stale[0].touched, false);
    assert.equal(d.orphanedWriting.length, 0);
  });
});

test('writing that already landed in source is not treated as orphaned', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    const mine = 'A sentence I wrote on the bus, and then applied.';
    editBlock(dir, 'README.md', ledger.entries[0].id, mine);
    const applied = ledgerWith(entry({ text: mine, status: 'human', previous_ai_text: AI }));
    const [d] = outstandingDrafts(p, applied);
    assert.equal(d.stale[0].landed, true);
    assert.equal(d.orphanedWriting.length, 0);
    assert.deepEqual(rescueOrphans(p, applied), []);
  });
});

test('outstandingDrafts lists what each file holds', async () => {
  await withDrafts((p, dir) => {
    const other = entry({ text: 'Another string entirely, longer than five words.',
      occurrences: [{ file: 'README.md', line: 30, kind: 'md-block', raw: 'x' }] });
    const ledger = ledgerWith(entry(), other);
    writeDrafts(p, ledger);
    let [d] = outstandingDrafts(p, ledger);
    assert.equal(d.blocks, 2);
    assert.equal(d.dirty.length, 0);
    editBlock(dir, 'README.md', other.id, '@mine');
    [d] = outstandingDrafts(p, ledger);
    assert.equal(d.dirty.length, 1);
    assert.equal(draftHolding(p, ledger, idFor(AI)).source, 'README.md');
    assert.equal(draftHolding(p, ledger, 'nosuchentry00'), null);
  });
});

test('draft will not overwrite a draft holding writing unless forced', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, 'Half a thought, still going.');
    assert.deepEqual(writeDrafts(p, ledger).skippedDirty, ['README.md']);
    assert.match(fs.readFileSync(path.join(dir, 'README.md.md'), 'utf8'), /Half a thought/);
    writeDrafts(p, ledger, { force: true });
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'README.md.md'), 'utf8'), /Half a thought/);
  });
});

test('orphaned writing is set down before anything can overwrite it, once', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, 'The one good sentence of the day.');
    const moved = afterApply();
    assert.deepEqual(pruneDrafts(p, moved).removed, []);
    assert.equal(rescueOrphans(p, moved, ['README.md']).length, 1);
    const saved = fs.readFileSync(path.join(dir, 'README.md.orphaned.txt'), 'utf8');
    assert.match(saved, /The one good sentence of the day\./);
    rescueOrphans(p, moved, ['README.md']);
    assert.equal(fs.readFileSync(path.join(dir, 'README.md.orphaned.txt'), 'utf8'), saved);
  });
});

test('a finished draft is cleared', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, '@mine');
    pullDrafts(p, ledger);
    assert.equal(pruneDrafts(p, ledger).removed.length, 1);
    assert.equal(fs.existsSync(path.join(dir, 'README.md.md')), false);
  });
});

test('CRLF drafts are read, and no CR reaches the replacement', async () => {
  await withDrafts((p, dir) => {
    const ledger = ledgerWith(entry());
    writeDrafts(p, ledger);
    editBlock(dir, 'README.md', ledger.entries[0].id, 'Written on Windows.');
    const f = path.join(dir, 'README.md.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n'));
    const r = pullDrafts(p, ledger);
    assert.equal(r.recorded, 1);
    assert.equal(ledger.entries[0].replacement, 'Written on Windows.');
  });
});
