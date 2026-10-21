// The Reader as a bookmarklet: on whatever page you are looking at, fetch
// the site's /slop.json, read the page against it, mark each string by its
// declared status, and list the undeclared copy.
//
// Built into a `javascript:` URL by bundle.js (`slopchop bookmarklet`). The
// strings and the counts come from reader.js, run over the live DOM's
// markup, so they agree with `slopchop read` and with `sync`. Marking the
// page is only presentation: each text node and copy attribute is matched
// back to a string by its text. Click the bookmarklet again to take it all
// off.
//
// Browser only. Everything it shows from the disclosure goes in as text,
// never as markup.

import { readPage, disclosureUrl, describeStatus, byStatusOrder, declaredBy } from './reader.js';
import { slopText } from './slop.js';
import { COPY_ATTRS } from './extract/common.js';

const HOST = 'slopchop-reader';
const MARK = 'data-slopchop';
const OUTLINE = 'data-slopchop-outline';
// Where a <mark> would break the page: raw-text elements, form options, and
// SVG or MathML, which have no <mark>. The strings are still listed.
const SKIP = 'script, style, pre, noscript, textarea, template, select, option, svg, math';

// One colour per status, and a dashed outline for undeclared copy, so the
// two read apart at a glance. Hues, not a scale: none is better than another.
export const COLORS = {
  human: '#1f9d6b',
  'ai-revised': '#c27c0e',
  'ai-fine': '#4f6fd0',
  'not-copy': '#8a8f98',
  undeclared: '#c93a78',
};

const colorOf = (key) => COLORS[key] || COLORS['ai-fine'];

/** Run the Reader on `doc`, or take it off if it is already showing. */
export async function run({ doc = document, win = window } = {}) {
  if (doc.getElementById(HOST)) { clear(doc); return 'cleared'; }

  const url = disclosureUrl(win.location.href);
  let result = null, error = null;
  try {
    const r = await win.fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!r.ok) throw new Error(`No copy disclosure at ${url} (HTTP ${r.status}).`);
    result = await readPage(doc.documentElement.outerHTML, await r.json());
  } catch (e) {
    error = e instanceof SyntaxError ? `${url} is not valid JSON.` : e.message;
  }
  if (result) mark(doc, result);
  panel(doc, { url, result, error });
  return result;
}

/** text → the key its marks are coloured by: a base status, or 'undeclared'. */
function keysByText(result) {
  const out = new Map();
  for (const x of result.declared) out.set(x.text, x.base);
  for (const x of result.undeclared) out.set(x.text, 'undeclared');
  return out;
}

function mark(doc, result) {
  const keys = keysByText(result);
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
  const found = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest(`${SKIP}, #${HOST}`)) continue;
    const key = keys.get(slopText(n.nodeValue));
    if (key) found.push([n, key]);
  }
  for (const [n, key] of found) {
    const m = doc.createElement('mark');
    m.setAttribute(MARK, key);
    const c = colorOf(key);
    m.style.cssText = key === 'undeclared'
      ? `background:transparent;color:inherit;outline:2px dashed ${c};outline-offset:1px`
      : `background:${c}22;color:inherit;box-shadow:inset 0 -2px ${c}`;
    n.replaceWith(m);
    m.append(n);
  }

  // Copy in attributes (alt, placeholder, title…) marks its element.
  const selector = COPY_ATTRS.map((a) => `[${a}]`).join(',');
  for (const el of doc.body.querySelectorAll(selector)) {
    if (el.closest(`#${HOST}`)) continue;
    let key = null;
    for (const a of COPY_ATTRS) {
      const k = el.hasAttribute(a) ? keys.get(slopText(el.getAttribute(a))) : null;
      if (k && (!key || k === 'undeclared')) key = k;
    }
    if (!key) continue;
    el.setAttribute(OUTLINE, el.style.outline || '');
    el.style.outline = `2px ${key === 'undeclared' ? 'dashed' : 'solid'} ${colorOf(key)}`;
  }
}

function clear(doc) {
  doc.getElementById(HOST)?.remove();
  for (const m of doc.querySelectorAll(`mark[${MARK}]`)) m.replaceWith(...m.childNodes);
  for (const el of doc.querySelectorAll(`[${OUTLINE}]`)) {
    el.style.outline = el.getAttribute(OUTLINE);
    el.removeAttribute(OUTLINE);
  }
}

const CSS = `
:host { all: initial; }
.box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: min(380px, calc(100vw - 32px));
  max-height: min(70vh, 640px); overflow: auto; box-sizing: border-box; padding: 14px 16px;
  font: 13px/1.45 system-ui, sans-serif; color: #1d2125; background: #fff;
  border: 1px solid #d5d9de; border-radius: 10px; box-shadow: 0 10px 32px rgba(0,0,0,.18); }
@media (prefers-color-scheme: dark) { .box { color: #e6e8eb; background: #1d2125; border-color: #3a4048; } }
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.head b { flex: 1; font-size: 14px; }
button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; font-size: 18px; line-height: 1; padding: 2px 6px; }
.muted { opacity: .72; }
.statement { font-style: italic; margin: 6px 0 10px; }
.sum { margin: 8px 0; font-weight: 600; }
ul { margin: 4px 0 10px; padding-left: 0; list-style: none; }
li { margin: 3px 0; display: flex; gap: 8px; align-items: baseline; }
.sw { flex: none; width: 10px; height: 10px; border-radius: 2px; }
.n { margin-left: auto; font-variant-numeric: tabular-nums; }
h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; margin: 12px 0 4px; }
.text { flex: 1; overflow-wrap: anywhere; }
.where { flex: none; font-size: 11px; opacity: .72; }
.error { color: #c93a78; }
`;

function panel(doc, { url, result, error }) {
  const host = doc.createElement('div');
  host.id = HOST;
  const root = host.attachShadow({ mode: 'open' });
  const el = (tag, props = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style') e.style.cssText = v;
      else if (k.includes('-')) e.setAttribute(k, v);
      else e[k] = v;
    }
    e.append(...kids);
    return e;
  };

  const box = el('div', { className: 'box' });
  const close = el('button', { title: 'Close', 'aria-label': 'Close' }, '×');
  close.onclick = () => clear(doc);
  box.append(el('style', {}, CSS), el('div', { className: 'head' }, el('b', {}, 'Copy disclosure'), close));

  if (error) {
    box.append(el('p', { className: 'error' }, error));
  } else {
    const r = result;
    box.append(el('div', {}, `Declared by ${[declaredBy(r.declarant, url), r.contact].filter(Boolean).join(' · ')}`));
    box.append(el('div', { className: 'muted' }, `${url}${r.generated ? ` · ${r.generated}` : ''}`));
    if (r.statement) box.append(el('p', { className: 'statement' }, r.statement));

    const c = r.counts;
    box.append(el('p', { className: 'sum' },
      `${c.declared} of ${c.total} strings on this page declared · ${c.undeclared} undeclared`));
    if (c.notCopy) box.append(el('p', { className: 'muted' }, `${c.notCopy} more declared not copy, left out of the count.`));

    const legend = el('ul');
    for (const [status, n] of byStatusOrder(c.byStatus)) {
      const base = status.replace(/\+$/, '');
      legend.append(el('li', {}, el('span', { className: 'sw', style: `background:${colorOf(base)}` }),
        el('span', {}, `${status}: ${describeStatus(status)}`), el('span', { className: 'n' }, String(n))));
    }
    legend.append(el('li', {}, el('span', { className: 'sw', style: `border:2px dashed ${COLORS.undeclared};box-sizing:border-box` }),
      el('span', {}, 'undeclared'), el('span', { className: 'n' }, String(c.undeclared))));
    box.append(legend);

    if (r.undeclared.length) {
      box.append(el('h3', {}, 'Undeclared copy'));
      const list = el('ul');
      for (const u of r.undeclared) {
        const where = u.where.filter((w) => w !== 'text').join(', ');
        list.append(el('li', {}, el('span', { className: 'text' }, u.text), where ? el('span', { className: 'where' }, where) : ''));
      }
      box.append(list);
    }
    if (r.outOfScope.length) {
      box.append(el('h3', {}, 'Out of scope, by the declarant'));
      box.append(el('ul', {}, ...r.outOfScope.map((t) => el('li', {}, el('span', { className: 'text' }, t)))));
    }
    box.append(el('p', { className: 'muted' },
      "Hashes of this page's text, looked up in the site's slop.json. It shows what the declarant says, and checks none of it."));
  }

  root.append(box);
  doc.body.append(host);
}
