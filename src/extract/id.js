// The ledger's ID for a string: the first 12 hex characters of SHA-256 over
// its collapsed text.
//
// Kept apart from common.js so the rest of the markup extraction carries no
// Node imports and runs in a browser as it is (the Reader does). The ID a
// copy disclosure publishes is defined separately, in slop.js; today the two
// agree, and slop.test.js says so.

import crypto from 'node:crypto';
import { collapse } from './common.js';

export function idFor(text) {
  return crypto.createHash('sha256').update(collapse(text)).digest('hex').slice(0, 12);
}
