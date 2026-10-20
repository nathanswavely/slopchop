// Template expressions inside copy: the `{…}` in Svelte and JSX text, the
// `{{ … }}` in Vue and Liquid templates, the `${…}` in a JS template string.
//
// They are code, not words. A visitor never reads `{seats.length}`; they
// read a number. So they are left out of word counts, the review page shows
// them as locked chips, and a rewrite that drops or changes one is refused.
// The entry's text keeps them verbatim: writeback has to find the exact
// original in source.
//
// No Node imports: the review page loads this file as it is.

/**
 * Which expression syntax an occurrence's text can hold, or null.
 * Markdown, catalogs and attributes hold none: braces there are literal.
 */
export function syntaxFor(kind, quote) {
  if (kind === 'markup' || kind === 'jsx-text') return { brace: true, dollar: true };
  if (kind === 'html-text') return { mustache: true };
  if ((kind === 'js-string' || kind === 'jsx-string') && quote === '`') return { dollar: true };
  return null;
}

/** Every syntax any of an entry's occurrences can hold, or null. */
export function syntaxOf(occurrences) {
  let out = null;
  for (const o of occurrences || []) {
    const s = syntaxFor(o.kind, o.quote);
    if (s) out = { ...out, ...s };
  }
  return out;
}

/** The index just past the `}` that closes the `{` at `i`, or -1. */
function closeOf(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') depth++;
    else if (c === '}') { if (--depth === 0) return j + 1; }
    else if (c === '"' || c === "'") { j = endOfQuote(s, j); if (j < 0) return -1; }
    else if (c === '`') { j = endOfTemplate(s, j); if (j < 0) return -1; }
  }
  return -1;
}

/** The index of the quote that closes the string opened at `i`, or -1. */
function endOfQuote(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === q) return j;
    if (s[j] === '\n') return -1;
  }
  return -1;
}

/** The index of the backtick that closes the template opened at `i`, or -1. */
function endOfTemplate(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') return j;
    if (s[j] === '$' && s[j + 1] === '{') {
      const end = closeOf(s, j + 1);
      if (end < 0) return -1;
      j = end - 1;
    }
  }
  return -1;
}

/**
 * The expressions in `text`, as `{start, end, text}` spans, in order.
 * A brace that never closes is literal text, not an expression.
 */
export function expressions(text, syntax) {
  const out = [];
  if (!syntax || !text) return out;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    let start = -1;
    if (c === '$' && text[i + 1] === '{' && syntax.dollar) start = i;
    else if (c === '{' && syntax.brace) start = i;
    else if (c === '{' && text[i + 1] === '{' && syntax.mustache) start = i;
    if (start < 0) continue;
    const open = text[start] === '$' ? start + 1 : start;
    const end = closeOf(text, open);
    if (end < 0) continue;
    if (syntax.mustache && !syntax.brace && text[open] === '{' && text[end - 2] !== '}') continue;
    out.push({ start, end, text: text.slice(start, end) });
    i = end - 1;
  }
  return out;
}

/** The text cut into prose and expression parts: `[{text, expr}]`, in order. */
export function splitExpressions(text, syntax) {
  const parts = [];
  let at = 0;
  for (const x of expressions(text, syntax)) {
    if (x.start > at) parts.push({ text: text.slice(at, x.start), expr: false });
    parts.push({ text: x.text, expr: true });
    at = x.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), expr: false });
  return parts;
}

const HAS_WORD = /[\p{L}\p{N}]/u;
const GAP = '\u0000';

/**
 * Words a person reads, with expressions left out. Punctuation that only
 * sat against an expression (the `.` in `{n} held.` once `held` is gone,
 * say) is not a word either. Text without expressions counts as before.
 */
export function countWords(text, syntax) {
  const xs = expressions(text, syntax);
  if (!xs.length) return text.trim().split(/\s+/).filter(Boolean).length;
  let gapped = '';
  let at = 0;
  for (const x of xs) { gapped += text.slice(at, x.start) + GAP; at = x.end; }
  gapped += text.slice(at);
  return gapped.split(/\s+/).filter((tok) => {
    const rest = tok.split(GAP).join('');
    if (!rest) return false;
    return !tok.includes(GAP) || HAS_WORD.test(rest);
  }).length;
}

const squash = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * The original's expressions that `next` lacks, and the ones `next` has
 * that the original does not, compared with whitespace collapsed.
 */
export function compareExpressions(text, next, syntax) {
  if (!syntax) return { missing: [], added: [] };
  const added = expressions(next, syntax).map((x) => squash(x.text));
  const missing = [];
  for (const x of expressions(text, syntax)) {
    const k = added.indexOf(squash(x.text));
    if (k === -1) missing.push(squash(x.text));
    else added.splice(k, 1);
  }
  return { missing, added };
}

/**
 * Why `next` cannot replace `text`: an expression of the original is
 * missing or changed, or one was added. Expressions come from the code,
 * so a rewrite moves words around them and leaves them as they are.
 * Order may change. Returns a sentence, or null when nothing is wrong.
 */
export function expressionProblem(text, next, syntax) {
  const { missing, added: left } = compareExpressions(text, next, syntax);
  const list = (xs) => xs.join(', ');
  if (missing.length && left.length) {
    return `changes ${list(missing)}. Expressions are code: keep them exactly as they are and rewrite the words around them`;
  }
  if (missing.length) {
    return `drops ${list(missing)}. Expressions are code: keep each one and rewrite the words around them`;
  }
  if (left.length) {
    return `adds ${list(left)}, which is not in the original. A rewrite can only use the expressions already there`;
  }
  return null;
}

/** The same check for a ledger entry, with the syntax its occurrences hold. */
export function rewriteProblem(entry, next) {
  return expressionProblem(entry.text, next, syntaxOf(entry.occurrences));
}
