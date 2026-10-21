// Short strings a template shows, found by what the template shows.
//
// A string literal in code only counts as copy when it is sentence-shaped,
// because most short literals are identifiers. But a short one can still be
// what a visitor reads: `name: 'Hello'` in a list of services, rendered by
// `<span>{service.name}</span>`. Guessing from the string alone floods the
// ledger with ids and colours. The template says which it is: a key it
// renders as text, or into an attribute a person reads, is copy wherever a
// string is given for it.
//
// So, two halves:
//
//   renderedKeys   the keys a template shows: `{service.name}` in text,
//                  `title={social.name}`, `{label}` (a prop or a field
//                  destructured in a .map). The last name in the chain.
//   keyedStrings   string values given for those keys in code: object
//                  fields (`name: 'Hello'`) and defaults (`title = 'Home'`),
//                  when the value clears the bar a message catalog's does.
//
// Plus componentProps: a string passed straight to a component under a name
// like copy (`<Layout description="…">`), which no HTML attribute list knows.
//
// Keys are pooled across the project, since a list of services usually lives
// in one file and the template that shows it in another.

import { COPY_ATTRS, isCatalogCopy, isProseLiteral, pushHit, verbatim, collapse, unescapeString } from './common.js';
import { stripComments } from './js.js';

// Props whose value a component shows a person, on top of COPY_ATTRS.
export const COPY_PROPS = ['description', 'label', 'heading', 'subheading', 'subtitle', 'caption', 'summary', 'text', 'message'];

const COPY_POSITIONS = new Set([...COPY_ATTRS, ...COPY_PROPS]);

/**
 * Every tag in `markup`, opening or closing, as [start, end) spans. A tag runs to the first `>`
 * outside quotes and outside `{…}`, so `onClick={() => go()}` and
 * `title={a > b ? 'x' : 'y'}` stay inside it.
 */
export function tagSpans(markup) {
  const out = [];
  const open = /<\/?([A-Za-z][\w.:-]*)/g;
  let m;
  while ((m = open.exec(markup)) !== null) {
    let depth = 0;
    let quote = null;
    let i = m.index + m[0].length;
    for (; i < markup.length; i++) {
      const c = markup[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (depth > 0 && (c === '"' || c === "'" || c === '`')) quote = c;
      else if (c === '>' && depth === 0) break;
      else if (c === '<' && depth === 0) break;       // never closed: not a tag
    }
    if (markup[i] !== '>') continue;
    out.push({ name: m[1], start: m.index, end: i + 1 });
    open.lastIndex = i + 1;
  }
  return out;
}

// `{a}`, `{a.b}`, `{a?.b.c}`: a plain reference, nothing computed.
const REF = /\{\s*([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\s*\}/g;
// An attribute whose value is a plain reference: `title={social.name}`.
const ATTR_REF = /(?<=\s)([A-Za-z_][\w:-]*)\s*=\s*\{\s*([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\s*\}/g;
const keyOf = (ref) => ref.split(/\??\./).pop();

/**
 * The keys `markup` renders where a person reads them: between two tags,
 * as an element's text, or as an attribute a person reads. Not `href={…}`,
 * and not Svelte's `{src}` shorthand. Added to `keys`, which is returned.
 */
export function renderedKeys(markup, keys = new Set()) {
  const tags = tagSpans(markup);
  tags.forEach((tag, i) => {
    for (const a of markup.slice(tag.start, tag.end).matchAll(ATTR_REF)) {
      if (COPY_POSITIONS.has(a[1])) keys.add(keyOf(a[2]));
    }
    const next = tags[i + 1];
    if (!next) return;
    for (const r of markup.slice(tag.end, next.start).matchAll(REF)) keys.add(keyOf(r[1]));
  });
  return keys;
}

/**
 * Static strings passed to a component (a tag that starts with a capital)
 * under a copy-like prop name. COPY_ATTRS on any tag are found elsewhere.
 */
export function componentProps(file, markup, src, kindPrefix, { text = (s) => collapse(s) } = {}) {
  const hits = [];
  const prop = new RegExp(`(?<=\\s)(${COPY_PROPS.join('|')})\\s*=\\s*(["'])([^"'{}]*?)\\2`, 'g');
  for (const tag of tagSpans(markup)) {
    if (!/^[A-Z]/.test(tag.name)) continue;
    const body = markup.slice(tag.start, tag.end);
    for (const m of body.matchAll(prop)) {
      const val = m[3];
      if (!isCatalogCopy(val)) continue;
      const index = tag.start + m.index + m[0].indexOf(m[2]) + 1;
      pushHit(hits, {
        file, raw: verbatim(src, index, val), index, src, kind: `${kindPrefix}:${m[1]}`, quote: m[2], text: text(val),
      });
    }
  }
  return hits;
}

// `name: 'Hello'`, `'name': "Hello"`, `title = 'Home'`, right after a `{`
// or a `,`: an object field or a destructuring default, not a ternary's
// `? a : 'b'`.
const KEYED = /(?<=[{,(][ \t\r\n]*)(["']?)([A-Za-z_$][\w$]*)\1[ \t]*([:=])[ \t]*(["'`])((?:[^\\\n]|\\.)*?)\4/g;

// A date or number format's options (`{ month: 'short' }`): a template that
// shows `{month}` shows the formatted date, not the word "short".
const FORMAT_OPTION = /^(short|long|narrow|numeric|2-digit)$/;

/**
 * Short strings given for a rendered key in `code`, which starts at
 * `offset` in `fullSrc`. Sentence-shaped ones are left to the string-literal
 * pass, which finds them anyway.
 */
export function keyedStrings(file, code, fullSrc, offset, keys, kind = 'js-string', ignoreKeys = null) {
  const hits = [];
  if (!keys || !keys.size) return hits;
  for (const m of stripComments(code).matchAll(KEYED)) {
    const [, , key, , quote, val] = m;
    if (!keys.has(key) || ignoreKeys?.has(key)) continue;
    if (m[3] === '=' && m[1]) continue;              // `'a' = …` is not a default
    if (quote === '`' && val.includes('${')) continue;
    // Judged as it renders: `'Don\'t'` is "Don't". A backslash still there
    // after that was typed as one, and is not copy.
    const shown = unescapeString(val);
    if (shown.includes('\\') || FORMAT_OPTION.test(shown) || isProseLiteral(shown) || !isCatalogCopy(shown)) continue;
    const index = offset + m.index + m[0].length - val.length - 1;
    pushHit(hits, { file, raw: verbatim(fullSrc, index, val), index, src: fullSrc, kind, quote, at: key, text: collapse(shown) });
  }
  return hits;
}
