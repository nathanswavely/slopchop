// Helpers every extractor shares. No Node imports: the Reader runs the
// markup half of this in a browser.
//
// Two texts are recorded for each hit, and the difference matters:
//
//   entry.text        the collapsed, readable form. What you review, and
//                     what the entry's ID hashes. Reflowing a paragraph in
//                     source does not orphan its review status.
//   occurrence.raw    the exact source substring. What writeback replaces.
//                     Keeping it verbatim is what makes writeback safe: it
//                     either finds an exact match or reports drift and
//                     refuses, and never guesses.

import { countWords } from '../expressions.js';
import { namedEntity } from './entities.js';

// Attributes whose values a person reads.
export const COPY_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description'];

// A JS/Go string literal has to clear all of these to count as prose. The
// filter is deliberately loose. A false positive costs one keystroke to mark
// `ai-fine` forever, while a false negative is a string that silently never
// gets reviewed. Over-collect on purpose.
export const CODEish = new RegExp([
  '[<>{}=_|\\\\]',                    // markup, template or path syntax
  '^https?:', '\\/\\/',               // URLs
  '\\.(js|go|svelte|css|json|md|ts|tsx|jsx|vue|html)$',   // filenames
  '^[a-z-]+\\/[a-z-]+$',              // mime types, route fragments
  '\\b\\d+(px|rem|em|vh|vw|ch)\\b',   // CSS lengths
  // Media queries, both kinds. Nobody reads a media query, so it is not copy.
  '\\((min|max)-(width|height)',
  '\\((any-)?(hover|pointer)\\s*:',
  '\\(prefers-[a-z-]+\\s*:',
  '\\(orientation\\s*:',
].join('|'), 'i');

export function collapse(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Words a person reads. `syntax` (see expressions.js) names the template
 * expressions the text can hold; they are code, and are not counted.
 */
export function wordCount(text, syntax = null) {
  return countWords(collapse(text), syntax);
}

export function tierFor(text, syntax = null) {
  const n = wordCount(text, syntax);
  if (n < 6) return 'label';
  if (n < 16) return 'helper';
  return 'prose';
}

/** Replace every match with spaces, preserving newlines so line numbers hold. */
export function blank(src, re) {
  return src.replace(re, (m) => m.replace(/[^\n]/g, ' '));
}

export function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

// A query, not a sentence. Two signals rather than one: an opening verb and
// a clause keyword somewhere after it. "Select a patch" and "Update your
// event details." are real copy, and a bare `^SELECT|^UPDATE` throws both
// away. Requiring FROM/WHERE/VALUES after the verb keeps the sentences and
// drops the statements.
const SQL_OPENS = /^\s*(SELECT|INSERT(\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM|WITH|CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|PRAGMA)\b/i;
const SQL_CLAUSE = /\b(FROM|WHERE|VALUES|SET|JOIN|GROUP\s+BY|ORDER\s+BY|LIMIT|ON\s+CONFLICT)\b/i;

/** Is this raw string embedded data (JSON, SQL) rather than prose? */
export function isData(body) {
  const t = body.trim();
  if (/^[[{]/.test(t)) return true;
  if (SQL_OPENS.test(t) && SQL_CLAUSE.test(t)) return true;
  const kv = (t.match(/"[\w.-]+"\s*:/g) || []).length;
  return kv >= 3;
}

// A sentence-shaped string literal: long enough, has a space, starts like a
// sentence, and does not look like code.
export function isProseLiteral(val) {
  if (val.length < 8 || !/\s/.test(val)) return false;
  if (!/[A-Za-z]{3}/.test(val)) return false;
  if (CODEish.test(val)) return false;
  return /^[A-Z(“'"]/.test(val.trim());
}

// A message-catalog value. Catalogs hold copy by definition, so the bar is
// lower than for a string literal in code: single words count ("Save"),
// interpolation braces are fine ("{count} items"). What is refused is the
// obviously non-copy: URLs, identifiers, colours, booleans.
export function isCatalogCopy(val) {
  const t = val.trim();
  if (!/[A-Za-z]{2}/.test(t)) return false;
  if (/^(true|false|null|yes|no|on|off)$/i.test(t)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(mailto|tel):/i.test(t)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return false;
  if (/^[\w-]+([./:#@\\-][\w-]*)+$/.test(t)) return false;     // paths, dotted keys, emails
  if (/^\.{0,2}\/\S*$/.test(t)) return false;                    // rooted or relative paths: /img/a.jpg, ../x
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(t)) return false;        // camelCase identifier
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(t)) return false;    // snake_case identifier
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(t)) return false;    // SCREAMING_SNAKE constant
  return true;
}

/**
 * Does a catalog key path pass through one of the ignored key names?
 * `bands[2].events[0].location` is under `events` and under `location`.
 * Data files that double as content (a list of gigs beside a band's bio)
 * use this to keep the facts out of review and the prose in.
 */
export function underIgnoredKey(at, ignoreKeys) {
  if (!at || !ignoreKeys || !ignoreKeys.size) return false;
  return at.split(/[.[\]]+/).some((k) => k && ignoreKeys.has(k));
}

// Kinds whose line breaks carry meaning. Collapsing a Markdown list to one
// line turns four bullets into one paragraph, and writeback would then put
// that flattened line back into the file. HTML and string literals have no
// such structure, so those stay collapsed.
export const BLOCK_KINDS = new Set(['md-block', 'go-doc-block', 'yaml-block']);

/**
 * Record one hit. `text` may be supplied when the readable form is not
 * simply the collapsed raw (decoded entities, unescaped JSON).
 */
export function pushHit(hits, { file, raw, index, src, kind, quote, text, at, indent }) {
  const shown = text !== undefined
    ? text
    : (BLOCK_KINDS.has(kind) ? raw.replace(/\s+$/, '') : collapse(raw));
  if (!collapse(shown)) return;
  const hit = { file, raw, text: shown, line: lineAt(src, index), kind, quote: quote || null };
  if (at) hit.at = at;
  if (indent !== undefined) hit.indent = indent;
  hits.push(hit);
}

/** Split prose into blank-line-separated blocks, skipping fenced code. */
export function blocks(body) {
  const out = [];
  const lines = body.split('\n');
  let buf = [];
  let bufStart = 0;
  let offset = 0;
  let inFence = false;

  const flush = () => {
    if (!buf.length) { buf = []; return; }
    const text = buf.join('\n').replace(/\s+$/, '');
    if (text.trim()) out.push({ text: text.replace(/^\s+/, ''), offset: bufStart });
    buf = [];
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) { flush(); inFence = !inFence; offset += line.length + 1; continue; }
    if (inFence) { offset += line.length + 1; continue; }
    if (!line.trim()) { flush(); offset += line.length + 1; continue; }
    if (!buf.length) bufStart = offset + (line.length - line.replace(/^\s+/, '').length);
    buf.push(line);
    offset += line.length + 1;
  }
  flush();
  return out;
}

// ------------------------------------------------------------- markup ---

// A block directive: Svelte {#if …}, {:else}, {/each}; Liquid/Jinja {% … %};
// EJS/ERB <% … %>. Not copy, and not a boundary the text-node regex knows
// about. An element wrapping a conditional yields one chunk with the
// directives inside it, so the chunk is split around them.
const DIRECTIVE = /\{[#:/][^{}]*\}|\{%[\s\S]*?%\}|<%[\s\S]*?%>/g;

/**
 * Split a text-node chunk at its block directives, keeping each segment's
 * offset within the chunk so writeback still points at real source.
 */
export function splitOnDirectives(chunk) {
  const out = [];
  let last = 0;
  for (const m of chunk.matchAll(DIRECTIVE)) {
    if (m.index > last) out.push({ text: chunk.slice(last, m.index), offset: last });
    last = m.index + m[0].length;
  }
  if (last < chunk.length) out.push({ text: chunk.slice(last), offset: last });
  return out;
}

/**
 * The chunk with its `{…}` and `{{…}}` expressions removed, to a fixed point
 * so nested ones go too.
 */
export function stripExpressions(chunk) {
  let out = chunk;
  for (;;) {
    const next = out.replace(/\{[^{}]*\}/g, '');
    if (next === out) return out;
    out = next;
  }
}

// Residue of an attribute or an expression rather than a text node. The
// text-node regex stops at the next `<`, so an attribute containing a `>`
// leaves the scan mid-tag, and the "text" after it is really code.
const ATTR_RESIDUE = /[{}]|=>|="|\/>|`/;

export function isMarkupNoise(chunk) {
  if (/\{[#:/]|\{%|<%/.test(chunk)) return true;
  const literal = stripExpressions(chunk).trim();
  if (ATTR_RESIDUE.test(literal)) return true;
  if (!literal) return true;
  // Words as a page shows them: `&rarr;` is an arrow, not the word "rarr".
  const shown = decodeEntities(literal);
  const words = shown.split(/\s+/).filter((w) => /[A-Za-z]{2}/.test(w));
  if (words.length < 1) return true;
  if (shown.length < 3) return true;
  return false;
}

/**
 * Text nodes in a chunk of markup with `<script>`, `<style>` and comments
 * already blanked. Shared by Svelte, HTML, Vue templates, JSX and MDX.
 * `offset` is where `markup` starts in `src`.
 */
export function textNodes(file, markup, src, offset, kind, { text = (s) => collapse(s) } = {}) {
  const hits = [];
  const textNode = />([^<]+)</g;
  let m;
  while ((m = textNode.exec(markup)) !== null) {
    const chunk = m[1];
    if (!collapse(chunk)) continue;
    for (const seg of splitOnDirectives(chunk)) {
      const segText = seg.text;
      if (!collapse(segText) || isMarkupNoise(segText)) continue;
      const lead = segText.match(/^\s*/)[0].length;
      const trail = segText.match(/\s*$/)[0].length;
      const inner = segText.slice(lead, segText.length - trail);
      if (!inner) continue;
      const index = offset + m.index + 1 + seg.offset + lead;
      pushHit(hits, { file, raw: verbatim(src, index, inner), index, src, kind, text: text(inner) });
    }
  }
  return hits;
}

/**
 * The substring of the real source at `index`, the same length as `seen`.
 * Extractors scan a copy with comments and scripts blanked to spaces, so
 * the text they see can differ from what is on disk. Writeback matches
 * against disk, so `raw` must come from there, always.
 */
export function verbatim(src, index, seen) {
  return src.slice(index, index + seen.length);
}

// An attribute name preceded by `:`, `@`, `.`, `[` or a word character is a
// binding (`:title="expr"` in Vue, `[title]` in Angular, `data-title`), not
// a static value a person reads.
const ATTR_BOUNDARY = '(?<![:.@\\w\\[-])';

/** Copy-bearing attributes with static values. */
export function attrHits(file, markup, src, offset, kindPrefix, attrs = COPY_ATTRS, { text = (s) => collapse(s) } = {}) {
  const hits = [];
  for (const attr of attrs) {
    const re = new RegExp(`${ATTR_BOUNDARY}${attr}\\s*=\\s*(["'])([^"'{}]*?)\\1`, 'g');
    let m;
    while ((m = re.exec(markup)) !== null) {
      const val = m[2];
      if (!collapse(val) || !/[A-Za-z]{2}/.test(val)) continue;
      const index = offset + m.index + m[0].indexOf(m[1]) + 1;
      pushHit(hits, {
        file, raw: verbatim(src, index, val), index, src, kind: `${kindPrefix}:${attr}`, quote: m[1],
        text: text(val),
      });
    }
  }
  return hits;
}

// ----------------------------------------------------------- entities ---

// The references people type most, looked up first. A no-break space reads
// as a plain one: the ID collapses it to a space either way, and the ledger
// stays legible. Every other name HTML defines comes from entities.js.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', laquo: '«', raquo: '»',
};

// What a browser makes of &#128; to &#159;: the characters windows-1252 put
// there, because that is what pages that use them meant.
const C1 = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/** A numeric reference's character, by the rules a browser follows. */
function codePoint(code) {
  if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
  return String.fromCodePoint(C1[code] ?? code);
}

/**
 * Decode character references the way a browser does, so the text recorded
 * from source is the text a page shows: every name HTML defines, and
 * numeric references with or without their `;`. A name needs its `;`; the
 * few a browser also takes without one are a parse error, and stay as typed.
 * An unknown name stays as typed, as it does on a page.
 */
export function decodeEntities(s) {
  return s.replace(/&(?:#x([0-9a-f]+);?|#(\d+);?|([a-z][a-z0-9]*);)/gi, (m, hex, dec, name) => {
    if (hex !== undefined) return codePoint(parseInt(hex, 16));
    if (dec !== undefined) return codePoint(parseInt(dec, 10));
    return NAMED[name] ?? namedEntity(name) ?? m;
  });
}

/** Collapsed, then decoded: a string of markup as a page shows it. */
export function decodedText(s) {
  return decodeEntities(collapse(s));
}

/** Encode only what would break markup: a bare `&` and `<`. */
export function encodeEntities(s) {
  return s.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;');
}
