---
status: proposed
---

# The `slop: 1` ID is a frozen public algorithm, separate from the ledger ID

A Reader on someone else's domain must compute exactly the hash that `report` published, so the ID in `slop.json` is a public spec: the first 12 hex characters of SHA-256 over the UTF-8 text, with each run of whitespace collapsed to one space and the ends trimmed. The text is the readable form, with entities decoded the way a browser's DOM gives it. Today this matches the ledger's internal `idFor` exactly, but the two are defined separately. If the ledger's hashing ever changes, `report` keeps emitting `slop: 1` IDs, and a different rule ships as `slop: 2`.

Unicode normalization (NFC) was left out on purpose. Adding it would change every existing ledger ID and orphan people's review statuses, all to fix a rare case.
