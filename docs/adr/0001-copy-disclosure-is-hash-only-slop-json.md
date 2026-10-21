---
status: proposed
---

# A copy disclosure is a hash-only slop.json, and a Reader finds the copy

Closed-source sites need a way to say who wrote their copy without publishing their source. The site publishes `/slop.json`: an optional declarant and contact, a plain statement that it is self-reported, out-of-scope reasons, and a map of string **ID** to **Status**. It contains no text and no locations. A **Reader** hashes the text on a live page and looks each ID up, so where a string appears is worked out from the page itself rather than declared. Pending rewrites and unreviewed strings are left out, so anything a Reader cannot find reads as undeclared: when the file is stale or incomplete, it errs toward understating.

## Considered options

- **An "audit file".** Rejected: SlopChop verifies nothing, and "audit" implies someone did.
- **A page map built from static output (URL → entries).** Rejected once a Reader could hash live pages: it tied v1 to static builds and went stale the moment a page changed.
- **IDs embedded in the HTML as `data-slop` attributes.** Rejected: an ID is a hash of the text, so any tag that would verify is one a Reader can recompute. The tag added page weight and a build step for no new information.
- **Text alongside each ID, so the file reads without a tool.** Rejected: nobody reads a list of hashes anyway, and leaving the text out avoids publishing strings that are not live anywhere.
- **`copy.txt` as the name.** Rejected for `slop.json`. The self-deprecating name is deliberate: it nudges people to write their own copy. The contents stay neutral and never call a string slop.

## Consequences

- Publishing is opt-in through a `disclosure` block in `.slopchop.json`, written by `report`. Switching it off deletes the file instead of leaving the last one deployed.
- `"enabled": true` alone turns it on. The declarant's name and contact are optional and left out of the file when unset; an unnamed disclosure is declared by whoever owns the site's domain, and a Reader says so.
- Template strings (`about {event.event}`) never match rendered text and read as undeclared.
- Short labels are guessable from their hash. The missing text is a matter of size and focus, not privacy.
