// The browser's half of entities.js: what a named character reference
// stands for, asked of the browser itself, so the bookmarklet never ships
// the table. bundle.js puts this module in place of entities.js.
//
// The markup the bookmarklet reads comes from the DOM, which writes every
// character out as itself except & < > " and the no-break space, so this
// is all but never asked.

const cache = new Map();

/** The text a named reference stands for, without its & and ;. Undefined if HTML defines no such name. */
export function namedEntity(name) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return undefined;
  if (!cache.has(name)) {
    // A <textarea>'s contents are text, never markup, so the browser
    // decodes the reference and builds nothing.
    const t = document.createElement('textarea');
    t.innerHTML = `&${name};`;
    cache.set(name, t.value === `&${name};` ? undefined : t.value);
  }
  return cache.get(name);
}
