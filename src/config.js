// Find and load `.slopchop.json`, and turn it into a Project: every path
// the rest of the tool needs, resolved once.
//
// Scope is a policy decision, not a technical one. The config says which
// files produce words a visitor reads, and, just as importantly, what is
// deliberately left out and why, so the report can print the exclusions
// beside the numbers instead of hiding its own scope.

import fs from 'node:fs';
import path from 'node:path';
import { walk, globToRegExp } from './glob.js';

export const CONFIG_NAME = '.slopchop.json';

// Which extractor handles which extension, unless `languages` overrides it.
const BY_EXT = {
  '.svelte': 'svelte',
  '.astro': 'astro',
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.ts': 'js', '.mts': 'js', '.cts': 'js',
  '.jsx': 'jsx', '.tsx': 'jsx',
  '.vue': 'vue',
  '.go': 'go',
  '.md': 'md', '.markdown': 'md',
  '.mdx': 'mdx',
  '.html': 'html', '.htm': 'html',
  '.json': 'json',
  '.yml': 'yaml', '.yaml': 'yaml',
};

export const LANGUAGES = [...new Set(Object.values(BY_EXT)), 'go-errors'];

export const DEFAULTS = {
  ledger: 'copy/ledger.json',
  report: 'copy/REPORT.md',
  badge: 'copy/badge.json',
  drafts: 'copy/drafts',
  include: [],
  exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.*', '**/*.spec.*'],
  languages: {},
  frozen: [],
  ignoreKeys: [],
  outOfScope: [],
};

/** Walk up from `from` looking for the config file. */
export function findConfig(from = process.cwd()) {
  let dir = path.resolve(from);
  for (;;) {
    const candidate = path.join(dir, CONFIG_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Build a Project from a config file. `configPath` may be null, in which
 * case the file is searched for upward from cwd.
 */
export function loadProject({ configPath = null, cwd = process.cwd() } = {}) {
  const file = configPath ? path.resolve(cwd, configPath) : findConfig(cwd);
  if (!file) {
    const err = new Error(`no ${CONFIG_NAME} found in ${cwd} or any parent. Run: slopchop init`);
    err.code = 'NO_CONFIG';
    throw err;
  }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${file}: ${e.message}`); }
  return projectFrom(raw, file);
}

/** A Project from an already-parsed config object. Exported for tests. */
export function projectFrom(raw, configPath) {
  const config = { ...DEFAULTS, ...raw };
  if (!Array.isArray(config.include) || !config.include.length) {
    throw new Error(`${configPath}: "include" must list at least one glob`);
  }
  const configDir = path.dirname(configPath);
  const root = path.resolve(configDir, config.root || '.');
  const abs = (p) => path.resolve(root, p);

  const overrides = Object.entries(config.languages).map(([glob, lang]) => {
    if (!LANGUAGES.includes(lang)) {
      throw new Error(`${configPath}: unknown language "${lang}" for "${glob}" (one of ${LANGUAGES.join(', ')})`);
    }
    return { re: globToRegExp(glob), lang };
  });

  const draftDir = process.env.SLOPCHOP_DRAFTS_DIR
    ? path.resolve(process.env.SLOPCHOP_DRAFTS_DIR)
    : abs(config.drafts);

  return {
    root,
    configPath,
    config,
    ledgerPath: abs(config.ledger),
    reportPath: abs(config.report),
    badgePath: abs(config.badge),
    draftDir,
    frozen: new Set(config.frozen),
    ignoreKeys: new Set(config.ignoreKeys),
    outOfScope: config.outOfScope,

    /** Posix-relative path from root for printing. */
    rel(p) {
      const r = path.relative(root, p);
      return r && !r.startsWith('..') ? r.split(path.sep).join('/') : p;
    },
    abs,

    /** Every in-scope file as {file, lang}, in a stable order. */
    sourceFiles() {
      const out = [];
      for (const file of walk(root, config.include, config.exclude)) {
        const lang = langFor(file, overrides);
        if (lang) out.push({ file, lang });
      }
      return out;
    },
  };
}

export function langFor(file, overrides = []) {
  for (const o of overrides) if (o.re.test(file)) return o.lang;
  return BY_EXT[path.posix.extname(file).toLowerCase()] || null;
}

// ------------------------------------------------------------------ init ---

// Candidate scopes, tried in order. A pattern makes it into the generated
// config only if it matches at least one file, so the starter config
// describes this repo rather than every repo.
const CANDIDATES = [
  { include: 'README.md', why: 'the first thing a newcomer reads' },
  { include: 'src/**/*.svelte' },
  { include: 'src/**/*.astro' },
  { include: 'src/**/*.{jsx,tsx}' },
  { include: 'src/**/*.vue' },
  { include: 'src/**/*.{js,ts}', why: 'toasts, error messages, option labels' },
  { include: 'app/**/*.{jsx,tsx}' },
  { include: 'components/**/*.{jsx,tsx}' },
  { include: 'pages/**/*.{jsx,tsx,mdx}' },
  { include: '{locales,locale,lang,i18n,messages,translations}/**/*.{json,yml,yaml}', why: 'message catalogs are copy already extracted' },
  { include: 'src/{locales,i18n,messages}/**/*.{json,yml,yaml}' },
  { include: '{content,docs,posts,blog}/**/*.{md,mdx}' },
  { include: '*.html' },
  { include: '{public,static,site,templates,layouts,_includes}/**/*.html' },
];

/** Propose a config for `root`. Returns {config, matched: [{include, files}]}. */
export function proposeConfig(root) {
  const matched = [];
  for (const c of CANDIDATES) {
    const files = walk(root, [c.include], DEFAULTS.exclude);
    if (files.length) matched.push({ ...c, files: files.length });
  }
  const config = {
    ledger: DEFAULTS.ledger,
    report: DEFAULTS.report,
    badge: DEFAULTS.badge,
    include: matched.map((m) => m.include),
    exclude: DEFAULTS.exclude,
    outOfScope: [
      { path: 'tests, source comments, commit messages', reason: 'Not read by a visitor.' },
    ],
  };
  return { config, matched };
}
