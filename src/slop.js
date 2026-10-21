// The `slop: 1` format: the ID a copy disclosure publishes, and how a
// status is written in it.
//
// A Reader on someone else's domain has to compute exactly the hash that
// `report` published, so this is a public spec and it is frozen
// (docs/adr/0002-slop-1-id-is-frozen.md):
//
//   the first 12 hex characters of SHA-256 over the UTF-8 text, with each
//   run of whitespace collapsed to one space and the ends trimmed.
//
// No Unicode normalization, on purpose. The text is the readable form, with
// entities decoded the way a browser's DOM gives it.
//
// It agrees with the ledger's idFor today, and is defined apart from it all
// the same. If the ledger's hashing ever changes, this does not; a different
// rule ships as `slop: 2`.
//
// No Node imports: the Reader and the bookmarklet run this in a browser.
// crypto.subtle is the one hash both have, and it is async.

export const SLOP_VERSION = 1;

export const STATEMENT = "Self-reported. These are the declarant's own statements about who wrote this copy.";

/** The text exactly as `slop: 1` hashes it. */
export function slopText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/** The `slop: 1` ID of a string. */
export async function slopId(text) {
  const bytes = new TextEncoder().encode(slopText(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex.slice(0, 12);
}

/**
 * A status as a disclosure writes it. `+` says a draft was replaced: the
 * file says one existed and never publishes it.
 */
export function formatStatus(status, replaced = false) {
  return replaced ? `${status}+` : status;
}

/** "human+" → { status: 'human', replaced: true }. */
export function parseStatus(value) {
  const s = String(value);
  return s.endsWith('+') ? { status: s.slice(0, -1), replaced: true } : { status: s, replaced: false };
}
