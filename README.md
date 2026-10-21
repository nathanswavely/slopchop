# SlopChop

[![copy provenance](https://raw.githubusercontent.com/nathanswavely/slopchop/main/copy/badge.svg)](https://github.com/nathanswavely/slopchop/blob/main/copy/REPORT.md)

SlopChop is copy review for a site or app you are building with AI coding tools. It finds every string a visitor can read, puts the paragraphs in front of you one at a time so you can either rewrite them or allow them as drafted. Each decision is recorded in a file next to the code, and a CI check keeps the next AI session from quietly undoing your work.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nathanswavely/slopchop/main/docs/screenshots/review-dark.png">
  <img alt="The review page: a queue of strings on the left, and on the right the selected paragraph with a note from triage, a box to write in, the save options, and the lines around it in the source." src="https://raw.githubusercontent.com/nathanswavely/slopchop/main/docs/screenshots/review-light.png">
</picture>

```sh
npx slopchop init      # writes .slopchop.json for this repo
npx slopchop sync      # builds copy/ledger.json and stamps the baseline
npx slopchop review    # opens the review page
```

## Why this exists

I've been building a lot with AI. AI code doesn't bother me, but AI copy gives me the ick. Even as the models get better, there is something that irks me about reading words that have my name on them but weren't written by me. But it's very difficult to parse through the copy and edit it without going back to pre-ai coding workflows. What I needed was a way to parse through the couple hundred paragraphs that need rewriting, skip the labels that did not, and keep a record so I would not have to make the same call twice. As an added bonus, open source projects have a transparent way of communicating to users which copy is human authored and which is not.

It is not built to be an AI detector or a "policing" service. It is self-reported and records what the reviewer decides. And, most importantly, it makes deciding possible, efficient, and simple.

## How it works

`slopchop sync` reads the files named in `.slopchop.json` and pulls out every string a person could read: paragraphs in Markdown, text between tags, `placeholder` and `alt` attributes, message catalog values, sentence-shaped strings in your JavaScript. Identical text in twelve places becomes one entry, so you decide "Save changes" once. The result is `copy/ledger.json`, with every entry marked unreviewed.

`slopchop review` opens a page on localhost that allows you to review your repo's copy and clear it for release, either by rewriting it in your voice, marking it as already yours, or leaving as "ai." Built in keyboard shortcuts make the process smooth.

<details>
<summary>Keyboard shortcuts</summary>
<img alt="The keyboard shortcut sheet, opened with the question mark key." src="https://raw.githubusercontent.com/nathanswavely/slopchop/main/docs/screenshots/shortcuts.png">
</details>

`slopchop apply` writes your versions into the source files. It is a dry run until you pass `--apply`, and it edits nothing unless it finds the exact original text where the ledger says it should be. Run it on a clean tree and read the diff.

`slopchop check` runs in CI and fails when a string shows up in the source with no decision behind it.

## The decisions

| Status | Means |
|---|---|
| `unreviewed` | AI wrote it and nobody has reviewed. Default Status. |
| `rewritten` | Human wrote replacement but `apply` has not written it yet. |
| `human` | Human wrote the copy, not a model. |
| `ai-fine` | Human reviewed and accepted the slop. |
| `ai-revised` | AI suggested a rewrite and you took it as new better slop. |
| `not-copy` | Nobody reads it: a format string, an identifier, a test fixture that got into scope. Left out of the totals and listed by name in the report. |

`ai-fine` is the one that makes this bearable. "Failed to load comments" does not need your voice, and neither do most of the labels around it. Marking them is one keystroke each, or one command for a whole file. The report counts them separately from `human`, so the number you end up with is honest about which is which.

## Getting through it without losing a weekend

Every string is sorted into a tier by length: paragraphs (16 words and up), helper text (6 to 15), and labels (under 6). Paragraphs are where the writing happens. Labels mostly need a glance, and a lot of them can go in bulk:

```sh
slopchop decide --status ai-fine --tier label --apply
slopchop decide --status human --file content/about.md --apply
slopchop decide --status ai-fine --max-words 4 --note "buttons and nav" --apply
```

`decide` only ever moves strings out of `unreviewed`, so running it again cannot undo something you decided by hand. It is a dry run until you pass `--apply`.

<img alt="The review page filtered to strings of four words or fewer, with four labels ticked and a bar at the foot offering already mine, leave as drafted, and back to unreviewed for all of them." src="https://raw.githubusercontent.com/nathanswavely/slopchop/main/docs/screenshots/bulk.png">

The queue also comes out as Markdown, for the places writing actually happens (a phone, a train, the GitHub web editor):

```sh
slopchop draft --file content/about.md    # writes copy/drafts/content/about.md.md
#  edit it wherever
slopchop pull                             # reads your writing back into the ledger
slopchop apply --apply
```

Each string sits between `<!-- copy:ID -->` markers. Write between them. A block you leave alone is skipped, so doing three and coming back later is fine. Replace a whole block with `@mine` if the words are already yours, or `@fine` to leave the draft in place.

A draft is a checkout. While one exists, decide that file in the draft and not in the review page, because the page can rewrite a string out from under a marker and then your writing has nowhere to land. The page refuses a decision on a checked-out string and names the file. `pull` never records a block you did not touch. If the source moves anyway, `pull --redraft` saves any stranded writing to a file beside the draft and cuts a fresh one. `SLOPCHOP_DRAFTS_DIR` points the drafts at a private repo, so the half-finished sentences stay out of a public one.

## A first pass from a model

Two hundred paragraphs is still a lot to sort by hand. `triage` sends the unreviewed strings to Claude on your own key and asks which ones carry your voice and read as drafted, which are worth a glance, and which nobody needs to touch. It quotes the phrases that gave each one away. Nothing changes status; the review page just puts the rewrite pile first and underlines the tells.

```sh
export ANTHROPIC_API_KEY=...                       # yours; SlopChop has no account
slopchop triage                                    # dry run: what would be sent, and how much
slopchop triage --apply
slopchop decide --triage fine --status ai-fine     # the model's "fine" pile, if you agree
slopchop suggest --apply                           # rewrites to start from, for the rewrite pile
```

Labels are skipped unless you ask for them with `--tier label`. `--file`, `--limit`, and `--id` narrow either command, and running one again only sends what has no answer yet.

A suggestion sits under your own box in the review page, not in it. `s` copies it in when you want a starting point. If you save it without changing anything, it lands as `ai-revised`, and the report and badge count it apart from `human`. Change one word and it is yours, which is the point: the suggestion is there to get you unstuck, not to finish the job.

It uses `claude-opus-5-5` at medium effort unless `.slopchop.json` says otherwise (`"model"`, `"effort"`). Point `"voice"` at a file of notes on how you write, and both commands read it.

## Keeping it that way

It would be rough if you had to re-label already reviewed strings.

In an ever-evolving codebase, maintaining a seamless review workflow is crucial, empowering teams to unlock consistent, high-quality copy at every stage of development.

So the first `sync` stamps a baseline: every unreviewed string at that moment is accepted as existing debt, and `check` fails only when a string that is not in the baseline shows up undecided. You can leave the backlog alone for a month and CI stays green. New copy has to be looked at before it merges. When the backlog reaches zero, set `"strict": true` in the ledger and the check fails on any unreviewed string at all.

```yaml
permissions:
  contents: read
  pull-requests: write
steps:
  - uses: actions/checkout@v7
  - uses: nathanswavely/slopchop@v1
```

The action carries the tool inside it, so there is nothing to install. It fails the job and lists the new strings in the job summary, with the file and line for each.

On a pull request it also says so on the pull request: one summary comment that stays current, and a comment on each new string the diff touches. If you wrote a rewrite in the ledger and never ran `apply`, it shows up as a suggestion block, and committing the suggestion counts the same as applying it. The next `sync` sees your words in the source and records them as yours. A fork's token cannot comment, so on a fork you get the job summary and nothing else. Set `comment: false` to turn it off, or run `slopchop comment --base main` to see what it would say.

## Setting it up

```sh
npx slopchop init
```

`init` looks at the repo and writes a `.slopchop.json` with the patterns that matched something. Edit it to taste:

```json
{
  "include": ["src/**/*.{svelte,ts}", "content/**/*.{md,mdx}", "locales/en.json"],
  "exclude": ["**/*.test.*"],
  "languages": { "internal/handler/**/*.go": "go-errors" },
  "frozen": ["legacyCharterText"],
  "outOfScope": [
    { "path": "docs/adr/", "reason": "Engineering notes. Nobody's voice to reclaim." }
  ]
}
```

What counts as copy, by file type:

| Files | What comes out |
|---|---|
| `.md` `.mdx` | Paragraphs, headings, and list blocks. Frontmatter values. Text inside HTML or JSX blocks. MDX imports, exports, and expressions are skipped. |
| `.json` `.yml` `.yaml` | Every string value in a message catalog, with its key path. URLs, identifiers, colors, and booleans are dropped. |
| `.html` | Text nodes, `placeholder`, `title`, `alt`, `aria-label`, and `<meta>` descriptions. Not `<script>`, `<style>`, `<pre>`, or comments. Liquid and Jinja tags split copy; `{{ }}` stays inside it. |
| `.svelte` `.vue` | Markup text and attributes, plus sentence-shaped strings in `<script>`. |
| `.jsx` `.tsx` | Text between tags, copy attributes, and prose string literals. |
| `.js` `.ts` | Sentence-shaped string literals: toasts, error messages, option labels. |
| `.go` | Raw-string documents a paragraph at a time, interpreted strings that read as sentences, and the messages inside `{"error":"..."}` bodies. |

The filters over-collect on purpose. A false positive costs one keystroke; a false negative is a string you never see. If something odd shows up in the queue, mark it and keep going.

## Where it will get in your way

In HTML, JSX, and Vue, an inline element splits the sentence around it. `Call us at <code>555-0100</code> or stop by` shows up as two entries. Markdown does not have this problem, since a paragraph is one block whatever is inside it.

The YAML reader is a subset: block mappings, sequences, plain and quoted scalars, and `|` and `>` blocks. Flow collections, anchors, and tags are skipped rather than guessed at.

Writeback refuses anything that would break the file it lands in (a `{` in JSX text, a quote that would close a YAML scalar, a newline in an attribute) and tells you which entry and why. It would rather leave a string undone than produce a file that does not build.

## What it does not do

- It does not send your text anywhere you did not ask it to. There is no server and no account. The review page is a local process reading local files, the pull request comments go to the same GitHub that holds the code, and the only model calls are `triage` and `suggest`, on your key, after a dry run.
- It does not certify anything. The report and badge exist so you can see your own progress. If you want proof for someone else, this is not it, and I am not sure anything is.
- It does not write for you. It will suggest, if you ask, but a suggestion you take without editing is recorded as `ai-revised`, so `human` only ever means a person typed it.

## Report and badge

```sh
slopchop report
```

writes `copy/REPORT.md` with the counts by status and tier, the scope and what was left out of it, and every replaced draft next to the text that replaced it. It also writes `copy/badge.json` for shields.io and `copy/badge.svg` for a repo that would rather not call out. The badge shows two numbers, reviewed and human-written, because either one alone overstates things.

## A copy disclosure, for a site whose source is closed

The report lives in the repo. For a closed-source site, `report` can also publish a copy disclosure: a `slop.json` at the site root that says, string by string, what human declared. It holds IDs and statuses only, with no text and no file paths. Anyone can check a page against it with a Reader, which hashes the text on the page and looks each ID up.

It is off until you add a block to `.slopchop.json`. `init` never adds one.

```json
"disclosure": {
  "enabled": true,
  "path": "public/slop.json",
  "declarant": "Your name or your studio's",
  "contact": "you@example.com"
}
```

`declarant` and `contact` are optional, and `"enabled": true` alone turns it on. Leave them out and the file names nobody: a Reader says it is declared by the owner of the site's domain.

Or open **Disclosure** in the review page, which edits only this block, previews exactly what would be published, and asks once before the first switch-on. Then:

```sh
slopchop report                          # writes public/slop.json beside the report
slopchop read https://example.com/       # what a Reader makes of a page
slopchop read dist/index.html            # a local build, against the project's slop.json
slopchop bookmarklet --out reader.txt    # the Reader, for any page in your browser
```

The file looks like this:

```json
{
  "slop": 1,
  "declarant": "Your name or your studio's",
  "contact": "you@example.com",
  "generated": "2026-10-20",
  "statement": "Self-reported. These are the declarant's own statements about who wrote this copy.",
  "outOfScope": ["Translations follow the English; review the source language."],
  "copy": { "925dab06b202": "human+", "fae650861c27": "human", "3fa7c5ef191f": "ai-fine", "71a53ee68c81": "not-copy" }
}
```

The statuses are the ledger's, with nothing added. `human` says the declarant put the words there, not a model: a testimonial they chose and pasted in is `human`, and one a model drafted into the page is not. A `+` means the string replaced a model's draft. The draft is never published. `outOfScope` carries the reasons from your config and leaves the paths out. Unreviewed strings and rewrites you have not applied yet are left out, so a Reader shows that text as undeclared: a stale file understates rather than overstates. Set `"enabled": false` and the next `report` deletes the file instead of leaving the last one deployed.

For each page, a Reader lists the declared copy with its status, lists the undeclared copy by its text, and shows your out-of-scope reasons beside it. It counts `not-copy` strings separately and leaves them out of the page's total. The bookmarklet does the same on whatever page you are looking at, and marks each string on the page in its status's colour.

Where a Reader comes up short:

- Template strings never match. `about {event.name}` in source renders as `about Spring Fair`, so it reads as undeclared, and so does anything a script builds at runtime.
- Strings are cut the way `sync` cuts HTML: an inline element splits a sentence. A Markdown paragraph with a link or emphasis in it renders as several strings, none of which hash to the paragraph in the ledger.
- Short labels are easy to guess from their hash. Leaving the text out keeps the file small and focused, but it is not a privacy measure.

The ID is a public, frozen algorithm, `slop: 1`: the first 12 hex characters of SHA-256 over the UTF-8 text, with each run of whitespace collapsed to one space and the ends trimmed, and no Unicode normalization. A Reader anyone writes can compute it. [docs/adr](docs/adr) has the reasoning.

## Next

A review page that is more purpose built than just a code review.

To start, run `npx slopchop init` in the repo, then `sync`. The first sync stamps the baseline, so the check passes from the beginning. After that, open `slopchop review` and start with the paragraphs.
