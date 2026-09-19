// A throwaway project on disk for tests that need to touch real files.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectFrom } from '../src/config.js';

/**
 * Make a temp dir with `files` ({relPath: content}), and a Project whose
 * scope is exactly those files. `fn(project, dir)` runs, then it is removed.
 */
export async function withProject(files, fn, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slopchop-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
    const project = projectFrom(
      { include: Object.keys(files), exclude: [], ...extra },
      path.join(dir, '.slopchop.json'));
    return await fn(project, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
