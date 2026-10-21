// The local review UI. A workbench that runs on your machine while you
// write. Nothing here ships to anyone.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, save, stats, decide } from './ledger.js';
import { writeback } from './writeback.js';
import { outstandingDrafts, draftDirLabel } from './drafts.js';
import { rewriteProblem } from './expressions.js';
import { previewDisclosure, readBlock, writeBlock, disclosureOf, problemsOf, DEFAULT_PATH } from './disclosure.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BULK_STATUSES = ['human', 'ai-fine', 'not-copy', 'unreviewed'];

// The page's design system, vendored so the review page has no network
// dependency. Served by name from a fixed list, never by path.
const VENDOR = path.join(HERE, 'vendor', 'liquid-textile');
const VENDORED = {
  'foundation.css': 'text/css; charset=utf-8',
  'base.css': 'text/css; charset=utf-8',
  'behaviors.js': 'text/javascript; charset=utf-8',
};

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
  });
}

/** A few lines either side of an occurrence, so you can see what you're editing. */
function context(project, file, line, span = 4) {
  // Confine reads to the repo. This server is local, but a path that walks
  // out of the tree is never something the UI legitimately asks for.
  const abs = path.resolve(project.root, file);
  if (!abs.startsWith(project.root + path.sep)) return null;
  if (!fs.existsSync(abs)) return null;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const from = Math.max(0, line - 1 - span);
  const to = Math.min(lines.length, line + span);
  return { from: from + 1, lines: lines.slice(from, to) };
}

/**
 * What is checked out elsewhere, in the shape the page needs: which files,
 * and which entry ids they hold.
 */
function draftState(project, ledger) {
  const files = outstandingDrafts(project, ledger);
  const checkedOut = {};
  for (const d of files) for (const id of d.ids) checkedOut[id] = d.rel;
  return {
    dir: draftDirLabel(project),
    files: files.map((d) => ({
      source: d.source, rel: d.rel, blocks: d.blocks,
      written: d.dirty.length, stale: d.stale.length,
    })),
    checkedOut,
  };
}

/** The disclosure block on disk, which the page can have changed since startup. */
function currentBlock(project) {
  return fs.existsSync(project.configPath) ? readBlock(project.configPath) : project.config.disclosure;
}

export function serve(project, { port = Number(process.env.SLOPCHOP_PORT || 5175), portRequested = !!process.env.SLOPCHOP_PORT } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const html = fs.readFileSync(path.join(HERE, 'ui.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }

      if (req.method === 'GET' && url.pathname.startsWith('/lt/')) {
        const name = url.pathname.slice(4);
        if (!Object.hasOwn(VENDORED, name)) return json(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': VENDORED[name], 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(path.join(VENDOR, name)));
      }

      // The page finds expressions the same way the ledger does.
      if (req.method === 'GET' && url.pathname === '/expressions.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(path.join(HERE, 'expressions.js')));
      }

      if (req.method === 'GET' && url.pathname === '/api/ledger') {
        const ledger = load(project);
        return json(res, 200, {
          entries: ledger.entries, stats: stats(ledger), strict: !!ledger.strict,
          baseline: ledger.baseline || [],
          drafts: draftState(project, ledger),
          project: { name: path.basename(project.root), ledger: project.rel(project.ledgerPath) },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/context') {
        const file = url.searchParams.get('file');
        const line = Number(url.searchParams.get('line') || 1);
        if (!file) return json(res, 400, { error: 'file required' });
        return json(res, 200, { context: context(project, file, line) });
      }

      if (req.method === 'POST' && url.pathname === '/api/decide') {
        const { id, status, replacement, note, kind, force } = await readBody(req);
        const ledger = load(project);
        const entry = ledger.entries.find((e) => e.id === id);
        if (!entry) return json(res, 404, { error: 'no such entry' });

        // This string is checked out in a draft somewhere. Deciding it here
        // rewrites it, which retires its id, which orphans the marker holding
        // whatever is being written on the other surface. One file, one place.
        const held = force ? null : outstandingDrafts(project, ledger).find((d) => d.ids.includes(id));
        if (held) {
          return json(res, 409, {
            error: `checked out in ${held.rel}`,
            code: 'checked-out',
            draft: { rel: held.rel, source: held.source },
          });
        }

        // The page locks expressions already; this is the same rule for
        // anything that posts here without it.
        const problem = replacement ? rewriteProblem(entry, replacement) : null;
        if (problem) return json(res, 400, { error: `Not saved: this ${problem}.`, code: 'expressions' });

        decide(entry, { status, replacement, note, kind });
        save(project, ledger);
        return json(res, 200, { entry, stats: stats(ledger) });
      }

      // Many strings, one answer. Only the plain statuses: a rewrite is
      // always one string at a time. Nothing changes if any of them is
      // checked out in a draft, unless the caller says to go ahead anyway.
      if (req.method === 'POST' && url.pathname === '/api/decide-many') {
        const { ids, status, force } = await readBody(req);
        if (!Array.isArray(ids) || !ids.length) return json(res, 400, { error: 'ids required' });
        if (!BULK_STATUSES.includes(status)) {
          return json(res, 400, { error: `status must be one of: ${BULK_STATUSES.join(', ')}` });
        }
        const ledger = load(project);
        const byId = new Map(ledger.entries.map((e) => [e.id, e]));
        const missing = ids.filter((id) => !byId.has(id));
        if (missing.length) return json(res, 404, { error: `${missing.length} no longer in the ledger; reload` });

        if (!force) {
          const held = [];
          for (const d of outstandingDrafts(project, ledger)) {
            for (const id of d.ids) if (ids.includes(id)) held.push({ id, rel: d.rel, source: d.source });
          }
          if (held.length) return json(res, 409, { error: `${held.length} checked out in drafts`, code: 'checked-out', held });
        }

        const changed = ids.map((id) => decide(byId.get(id), { status, replacement: null }));
        save(project, ledger);
        return json(res, 200, { entries: changed, stats: stats(ledger) });
      }

      // The copy disclosure. The page edits only the `disclosure` block of
      // .slopchop.json; `report` is what writes or deletes slop.json.
      if (req.method === 'GET' && url.pathname === '/api/disclosure') {
        return json(res, 200, await previewDisclosure(project, load(project), currentBlock(project)));
      }

      if (req.method === 'POST' && url.pathname === '/api/disclosure') {
        const { enabled, declarant, contact, path: where, confirm } = await readBody(req);
        if (!fs.existsSync(project.configPath)) return json(res, 404, { error: `no ${project.rel(project.configPath)} to write to` });
        const before = readBlock(project.configPath);
        const block = {
          ...(before && typeof before === 'object' && !Array.isArray(before) ? before : {}),
          enabled: enabled === true,
          path: String(where || '').trim() || DEFAULT_PATH,
          declarant: String(declarant || '').trim(),
          contact: String(contact || '').trim(),
        };
        const problems = problemsOf(project, disclosureOf(project, block));
        if (problems.length) return json(res, 400, { error: problems.join('; '), code: 'invalid', problems });

        // A block only exists once the disclosure has been switched on, so
        // switching it off when there is none has nothing to record, and
        // the first switch-on is the one that asks.
        if (before == null && !block.enabled) {
          return json(res, 200, await previewDisclosure(project, load(project), before));
        }
        if (before == null && !confirm) {
          return json(res, 409, { error: 'This puts your name on a public file at /slop.json.', code: 'confirm' });
        }
        writeBlock(project.configPath, block);
        project.config.disclosure = block;
        return json(res, 200, await previewDisclosure(project, load(project), block));
      }

      if (req.method === 'POST' && url.pathname === '/api/apply') {
        const { dryRun = true } = await readBody(req);
        const ledger = load(project);
        const result = writeback(project, ledger, { apply: !dryRun });
        if (!dryRun) save(project, ledger);
        return json(res, 200, {
          ...result,
          blocked: result.blocked.map((b) => ({ id: b.entry.id, text: b.entry.text, reason: b.reason })),
          stats: stats(load(project)),
        });
      }

      json(res, 404, { error: 'not found' });
    } catch (err) {
      json(res, 500, { error: String(err && err.message || err) });
    }
  });

  const announce = () => {
    const { port: p } = server.address();
    console.log(`\n  SlopChop  →  \x1b[36mhttp://localhost:${p}\x1b[0m`);
    console.log(`  \x1b[2mEdits save to ${project.rel(project.ledgerPath)} as you go. Ctrl-C when done.\x1b[0m\n`);
  };

  // Windows reserves moving port ranges for Hyper-V and WSL, so a port that
  // worked yesterday starts refusing with EACCES. Asking the OS for any free
  // port beats hand-editing a number. An explicit SLOPCHOP_PORT is a
  // request, so it fails loudly instead.
  server.once('error', (err) => {
    const takeable = err.code === 'EACCES' || err.code === 'EADDRINUSE';
    if (portRequested || !takeable) {
      console.error(`\n  Cannot listen on 127.0.0.1:${port}: ${err.code}.\n`);
      process.exit(1);
    }
    console.log(`  \x1b[2m${port} is unavailable (${err.code}); asking for any free port.\x1b[0m`);
    server.once('error', (e) => {
      console.error(`\n  Cannot start the review server: ${e.code}.\n`);
      process.exit(1);
    });
    server.listen(0, '127.0.0.1', announce);
  });

  server.listen(port, '127.0.0.1', announce);
  return server;
}
