// A small glob matcher and tree walker, so the tool stays dependency-free.
//
// Supports what a scope file actually needs: `**`, `*`, `?`, `{a,b}` and
// `[abc]`. Patterns and paths are always posix-style and repo-relative. This
// is not a full implementation of any glob standard; it is the subset that
// lets a config say `src/**/*.{svelte,js}` and mean it.

import fs from 'node:fs';
import path from 'node:path';

/** Compile one glob to a RegExp matching a posix-relative path. */
export function globToRegExp(glob) {
  return new RegExp(`^${globSource(glob)}$`);
}

function globSource(glob) {
  let re = '';
  let i = 0;
  const g = glob.replace(/\\/g, '/').replace(/^\.\//, '');
  while (i < g.length) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        // `**/` matches zero or more directories; a trailing `**` matches the rest.
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 3; continue; }
        re += '.*'; i += 2; continue;
      }
      re += '[^/]*'; i++; continue;
    }
    if (c === '?') { re += '[^/]'; i++; continue; }
    if (c === '{') {
      const close = g.indexOf('}', i);
      if (close === -1) { re += '\\{'; i++; continue; }
      const alts = g.slice(i + 1, close).split(',').map((a) => globSource(a));
      re += `(?:${alts.join('|')})`;
      i = close + 1; continue;
    }
    if (c === '[') {
      const close = g.indexOf(']', i);
      if (close === -1) { re += '\\['; i++; continue; }
      re += g.slice(i, close + 1); i = close + 1; continue;
    }
    re += /[.+^$()|\\]/.test(c) ? `\\${c}` : c;
    i++;
  }
  return re;
}

export function matches(rel, patterns) {
  const p = rel.split(path.sep).join('/');
  return patterns.some((re) => re.test(p));
}

// Never worth walking, whatever the config says.
const ALWAYS_SKIP = new Set(['.git', 'node_modules']);

/**
 * Every file under `root` matching any include and no exclude, as
 * posix-style paths relative to root, sorted.
 */
export function walk(root, include, exclude = []) {
  const inc = include.map(globToRegExp);
  const exc = exclude.map(globToRegExp);
  const out = [];

  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (ALWAYS_SKIP.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (e.isDirectory()) {
        // An exclude like `dist/**` or `**/vendor/**` prunes the whole tree.
        if (exc.some((re) => re.test(`${rel}/x`))) continue;
        visit(abs);
      } else if (e.isFile()) {
        if (!inc.some((re) => re.test(rel))) continue;
        if (exc.some((re) => re.test(rel))) continue;
        out.push(rel);
      }
    }
  };
  visit(root);
  return out.sort();
}
