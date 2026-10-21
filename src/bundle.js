// Build the bookmarklet: bookmarklet.js and the modules it imports, inlined
// into one `javascript:` URL.
//
// SlopChop has no dependencies, so this is not a general bundler. It reads
// this package's own browser-safe modules, which keep to one shape (named
// `import { … } from './x.js'`, `export function` / `export const`), and
// wraps each in a function scope. Anything outside that shape, a Node
// import above all, stops the build rather than shipping something broken.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const EXPORT = /^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

/** Full-line comments and blank lines out; nothing else is touched. */
function stripComments(src) {
  const out = [];
  let inBlock = false;
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue; }
    if (!t || t.startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** One module as a function scope that returns its exports. */
function wrap(key, src, keyOf) {
  if (/^import\s/m.test(src.replace(IMPORT, ''))) {
    throw new Error(`${key}: only named imports of this package's own modules can be bundled`);
  }
  if (/^export\s+(default|\{|\*)/m.test(src)) throw new Error(`${key}: only export function/const/let/class can be bundled`);

  const names = [];
  let body = src.replace(IMPORT, (_, list, spec) => {
    const bindings = list.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${bindings.join(', ')} } = m[${JSON.stringify(keyOf(spec))}];`;
  });
  body = body.replace(EXPORT, (_, kind, name) => { names.push(name); return `${kind} ${name}`; });
  return `m[${JSON.stringify(key)}] = (() => {\n${stripComments(body)}\nreturn { ${names.join(', ')} };\n})();`;
}

/**
 * The modules `entry` needs, dependencies first, as one script body that
 * fills `m` with each module's exports. `entry` is relative to src/.
 */
export function bundleModules(entry) {
  const order = [];
  const seen = new Set();
  const visit = (abs) => {
    if (seen.has(abs)) return;
    seen.add(abs);
    const src = fs.readFileSync(abs, 'utf8');
    const dir = path.dirname(abs);
    for (const [, , spec] of src.matchAll(IMPORT)) {
      if (!spec.startsWith('.')) throw new Error(`${path.relative(SRC, abs)}: cannot bundle "${spec}"`);
      visit(path.resolve(dir, spec));
    }
    order.push({ abs, src });
  };
  visit(path.resolve(SRC, entry));

  const keyFor = (abs) => path.relative(SRC, abs).split(path.sep).join('/');
  return order.map(({ abs, src }) => {
    const dir = path.dirname(abs);
    return wrap(keyFor(abs), src, (spec) => keyFor(path.resolve(dir, spec)));
  }).join('\n');
}

/** The bookmarklet's script, before it becomes a URL. */
export function bookmarkletSource() {
  return `(async () => { const m = {};\n${bundleModules('bookmarklet.js')}\nawait m["bookmarklet.js"].run();\n})().catch((e) => alert('SlopChop Reader: ' + e.message));`;
}

/** The bookmarklet, ready to paste as a bookmark's URL. */
export function bookmarkletUrl() {
  return `javascript:${encodeURIComponent(bookmarkletSource())}`;
}
