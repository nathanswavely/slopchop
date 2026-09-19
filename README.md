# SlopChop

SlopChop is copy review for a site or app you built with AI. It finds every string a visitor can read, puts the paragraphs in front of you one at a time so you can write them yourself, and lets you wave through the labels and error messages that were never going to sound like anyone. Each decision is recorded in a file next to the code, and a CI check keeps the next AI session from quietly undoing your work.

## Why this exists

Patchwork, the community platform I run, was built with a lot of AI assistance, and most of its copy was drafted the same way. The build went quickly, and most of the words on the site were not mine. There were about two thousand strings, so "I will go through and fix it sometime" was never going to happen. What I needed was a way to find the couple hundred paragraphs that carried the voice, skip the labels that did not, and keep a record so I would not have to make the same call twice. This is that tool with the Patchwork-specific parts turned into configuration.

It is not an AI detector. It records what you decided, and it makes deciding fast.

## How it works

`slopchop sync` reads the files named in `.slopchop.json` and pulls out every string a person could read: paragraphs in Markdown, text between tags, `placeholder` and `alt` attributes, message catalog values, sentence-shaped strings in your JavaScript. Identical text in twelve places becomes one entry, so you decide "Save changes" once. The result is `copy/ledger.json`, with every entry marked unreviewed.

`slopchop review` opens a page on localhost. Paragraphs come first, because that is where the voice is. For each string you see the text, where it lives in the source, a few lines of context, and a box to write in. You write your version and save it, or you say the words are already yours, or you leave it as drafted and move on. `j` and `k` move through the queue, `h` marks a string as yours, `a` leaves it alone, and `⌘↵` saves what you wrote.

`slopchop apply` writes your versions into the source files. It is a dry run until you pass `--apply`, and it edits nothing unless it finds the exact original text where the ledger says it should be. Run it on a clean tree and read the diff.

`slopchop check` runs in CI and fails when a string shows up in the source with no decision behind it.

## The four decisions

| Status | Means |
|---|---|
| `unreviewed` | A model drafted it and nobody has looked. The default. |
| `rewritten` | You wrote a replacement and `apply` has not written it yet. |
| `human` | The text in source is your words. |
| `ai-fine` | You looked, and it is fine as drafted. |

`ai-fine` is the one that makes this bearable. "Failed to load comments" does not need your voice, and neither do most of the labels around it. Marking them is one keystroke each, or one command for a whole file. The report counts them separately from `human`, so the number you end up with is honest about which is which.

## Getting through it without losing a weekend

Every string is sorted into a tier by length: paragraphs (16 words and up), helper text (6 to 15), and labels (under 6). Paragraphs are where the writing happens. Labels mostly need a glance, and a lot of them can go in bulk:

```sh
slopchop decide --status ai-fine --tier label --apply
slopchop decide --status human --file content/about.md --apply
slopchop decide --status ai-fine --max-words 4 --note "buttons and nav" --apply
```

`decide` only ever moves strings out of `unreviewed`, so running it again cannot undo something you decided by hand. It is a dry run until you pass `--apply`.

The queue also comes out as Markdown, for the places writing actually happens (a phone, a train, the GitHub web editor):

```sh
slopchop draft --file content/about.md    # writes copy/drafts/content/about.md.md
#  edit it wherever
slopchop pull                             # reads your writing back into the ledger
slopchop apply --apply
```

Each string sits between `<!-- copy:ID -->` markers. Write between them. A block you leave alone is skipped, so doing three and coming back later is fine. Replace a whole block with `@mine` if the words are already yours, or `@fine` to leave the draft in place.

A draft is a checkout. While one exists, decide that file in the draft and not in the review page, because the page can rewrite a string out from under a marker and then your writing has nowhere to land. The page refuses a decision on a checked-out string and names the file. `pull` never records a block you did not touch. If the source moves anyway, `pull --redraft` saves any stranded writing to a file beside the draft and cuts a fresh one. `SLOPCHOP_DRAFTS_DIR` points the drafts at a private repo, so the half-finished sentences stay out of a public one.

## Keeping it that way

Rewriting two thousand strings once is a finite job. Keeping them rewritten is not, because the next AI session adds forty more and the site slides back without anyone noticing.

So the first `sync` stamps a baseline: every unreviewed string at that moment is accepted as existing debt, and `check` fails only when a string that is not in the baseline shows up undecided. You can leave the backlog alone for a month and CI stays green. New copy has to be looked at before it merges. When the backlog reaches zero, set `"strict": true` in the ledger and the check fails on any unreviewed string at all.

```yaml
- uses: nathanswavely/slopchop@v1
```

The action carries the tool inside it, so there is nothing to install. It fails the job and lists the new strings in the job summary, with the file and line for each.

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

- It does not send your text anywhere. There is no server, no account, and no model call. The review page is a local process reading local files.
- It does not certify anything. The report and badge exist so you can see your own progress. If you want proof for someone else, this is not it, and I am not sure anything is.
- It does not write for you. A first pass that flags the worst AI tells and suggests a direction is coming, and it will run on your own key. A suggestion you accept without editing will be recorded as its own status, so `human` only ever means a person typed it.

## Report and badge

```sh
slopchop report
```

writes `copy/REPORT.md` with the counts by status and tier, the scope and what was left out of it, and every replaced draft next to the text that replaced it. It also writes `copy/badge.json` for shields.io and `copy/badge.svg` for a repo that would rather not call out. The badge shows two numbers, reviewed and human-written, because either one alone overstates things.

## Next

A review page that feels like a writing tool rather than a code review: the draft beside your version, the tells marked inline, a sense of being done for the day. Pull request comments listing new strings, with suggested rewrites as suggestion blocks. GitLab. A hosted version for people who would rather not run anything, and the same container for people who would rather run it themselves.

To start, run `npx slopchop init` in the repo, then `sync`. The first sync stamps the baseline, so the check passes from the beginning. After that, open `slopchop review` and start with the paragraphs.
