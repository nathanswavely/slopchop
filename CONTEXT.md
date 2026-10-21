# SlopChop

SlopChop records what a person declares about who wrote the copy in their project. It records declarations; it does not detect, measure or verify authorship.

## Language

**Ledger**:
The record of every visitor-readable string in a project and the status its reviewer declared for it.
_Avoid_: Database, audit log

**Status**:
What the reviewer declared about one string: `human`, `ai-revised`, `ai-fine`, `not-copy`, or unreviewed.
_Avoid_: Score, rating, verdict

**ID**:
A string's fingerprint: a hash of its text. Anyone holding the text can recompute it, so it identifies a string without revealing or locating it.
_Avoid_: Key, tag

**Occurrence**:
Where a string sits in the project's source: a file and line. Private to the repo.
_Avoid_: Location (ambiguous with **Page**)

**Page**:
A URL where a string renders. One **Occurrence** can render on many **Pages**, and one **Page** draws on many files.
_Avoid_: Route, file, location

### Disclosure

**Copy disclosure**:
A site owner's published, self-reported list of **IDs** and their **Statuses**, readable by anyone without access to the source. It says nothing about where a string appears; a **Reader** works that out from the page. A declaration, not evidence.
_Avoid_: Audit, audit file, certificate, proof

**slop.json**:
The file a **Copy disclosure** is published as, at the site root. The name is deliberately self-deprecating, a nudge toward writing your own copy; the contents stay neutral and never call any string slop.
_Avoid_: slop.txt, copy.txt (both considered and rejected)

**Reader**:
A tool that checks a live **Page** against a **Copy disclosure** by hashing the page's text and looking up each **ID**.
_Avoid_: Validator, checker, scanner (all imply verifying authorship)

**Declarant**:
The one named person or organization who makes a **Copy disclosure** and can be contacted about it. A disclosure has exactly one.
_Avoid_: Auditor, reviewer (the **Ledger** does not record who reviewed each string)

**Replaced draft**:
The text a `human` or `ai-revised` string replaced. A **Copy disclosure** says one existed but never publishes it; a disclosure carries no text at all.

### What a Reader shows for a page

**Declared copy**:
Text on a **Page** whose **ID** is in the **Copy disclosure**, shown with that entry's **Status**.

**Undeclared copy**:
Text on a **Page** whose **ID** is not in the **Copy disclosure**. Listed by its text, never just counted, and part of the page's denominator.
_Avoid_: Unknown, unmatched (as a reader-facing word)

**Pending rewrite**:
A replacement the reviewer has decided but not yet applied to source. The page still shows the old text, so a **Copy disclosure** leaves the entry out until the rewrite is applied.

**Out-of-scope reason**:
The owner's public explanation for copy they excluded on purpose. A **Reader** shows it beside the **Undeclared copy** it may explain, and never counts that copy as covered.

`not-copy` strings are listed in a **Copy disclosure** like any other, and a **Reader** leaves them out of the page's denominator.

## Flagged ambiguities

- "Audit" was proposed for the published file and rejected: it implies an independent check, and SlopChop never checks anything. The file is a **Copy disclosure**.
- Embedding **IDs** in the page's HTML was considered and dropped: a **Reader** can recompute any ID that would have verified, so the tag added nothing.
