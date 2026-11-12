---
name: slopchop-card
description: Draft a SlopChop writing card, a short self-reported note for the end of a document or email saying which parts of the work were the person's and which were AI's. Use when someone asks for a SlopChop card, a writing card, an AI disclosure, a "how this was written" note, or a report card for something they wrote with AI help, or asks how much of a document was theirs.
---

# SlopChop writing card

A writing card is a few lines a person puts at the end of a report or email they made with AI help. It says who did which job: the ideas, the research, the draft, the edits, the checking. It is the person's own statement. You help them make it; you do not make it for them.

SlopChop records what people declare about their writing. It does not detect, measure, score or verify authorship, and neither does this card. Keep to that in everything below.

## The one rule

The card says what the person declares. Your part is to lay out what you saw in this session, propose a card from it, and ask about what you could not see. The person corrects it, and their answer is what goes on the card.

If their answer differs from what you saw, say what you saw once, plainly, and then write what they tell you. They may know things you do not: notes written by hand, an earlier session, a paragraph they wrote in another window. It is their name on it.

Never hand over a final card the person has not confirmed. A first proposal is always marked as a proposal.

## Step 1: say what you saw

Go back through the session and list, briefly and in order, what happened to this document. Stick to things you can point at:

- What the person gave you: an outline, bullet points, notes, pasted text, sources, a template. Say roughly how much ("an outline of six points and about 400 words of notes").
- What you produced: which sections you drafted, what research or sources you found, what structure or arguments you proposed that were not in their material.
- What the person changed: if they gave a draft back to you with edits, say which parts changed and roughly how much. If you never saw their edits, say that.
- What you did after: a polish, a cut, a restructure, a fact check.

Then list what you could not see. Earlier sessions, work in another tool, edits you were not shown, anything lost when a long conversation was summarized. If you have no history at all for this document (the person pasted in a finished piece and asked for a card), say so and go straight to the questions.

Do not flatter. Models tend to hand the person credit. Some guides:

- A topic is not an argument. "Write a report on our Q3 churn" is the person's subject. If the findings and recommendations came from you, the ideas row is not `mine`.
- Approving is not writing. A section the person read and kept is still your draft.
- When you are torn between two values, propose the one that gives the person less credit, and tell them it was a close call. They can move it.

## Step 2: propose a card and ask

Show the proposed card under the evidence, then ask only about the gaps and the close calls. Two or three short questions is typical. For example:

> I never saw your edits after the second draft. Did you change much by hand?
> The recommendation in section 4 came out of our back-and-forth. Ideas: `mostly mine`, or `shared`?

Ask who is declaring (their name, or nothing) if you do not know.

## Step 3: write the card they confirm

### Rows

Use these rows, in this order. Leave a row out when that job did not happen (an email with no research has no Research row). Do not add rows.

| Row | The job |
|---|---|
| Ideas | The argument, the conclusions, what the piece says. |
| Research | Finding the facts, sources and figures. |
| Draft | Writing the first full version. |
| Edits | Changing the draft into the final text. |
| Checked | Reading the final text and standing behind it. |
| Words | Optional. A ballpark of how much of the final wording is the person's own. |

### Values

Ideas, Research, Draft and Edits take exactly one of:

`mine` · `mostly mine` · `shared` · `mostly AI` · `AI`

Checked takes one of:

`all of it` · `most of it` · `skimmed` · `not checked`

Words takes one of:

`nearly all mine` · `about three quarters mine` · `about half mine` · `about a quarter mine` · `almost none mine`

After a value, the person may add a short note in their own words, a dozen words at most: `mostly AI, from my outline and notes`. Offer a note where it helps a reader; keep the person's wording if they give one.

No percentages. A figure like 62% claims a precision nobody has. If the person asks for a number, give the nearest Words value and say why. If they insist on a figure of their own, it is their card: write it as a note (`about half mine, I'd say 60%`).

Words is the only row about quantity. If you saw both what they wrote and the final text, you may tell them roughly how they compare as evidence. The value on the card is still their call, and the row is dropped if they would rather not guess.

### Lines under the rows

- `AI used:` the model or tool, if the person wants it named. Optional.
- The last line is always the signature: `Self-reported by NAME · SlopChop card`, or `Self-reported · SlopChop card` when they give no name. Never drop "Self-reported". Never write "verified", "certified", "audited" or "detected" anywhere on a card.

### Formats

Give the plain text card unless they ask for another. All three say the same thing.

**Plain text**, for anywhere. Follow `card.txt` in this folder.

**One line**, for a short email. Lead with the draft, since that is what a reader wonders about:

```
Written with AI: draft mostly AI, ideas and edits mine, all of it checked by me. Self-reported · SlopChop card
```

**HTML**, for an email or document that keeps formatting. Follow `card.html` in this folder exactly: copy it, change the values and notes, delete the rows that do not apply, and set each row's four cells from the table in that file's comment. Do not restyle it, add images, add web fonts, or move styles out of the attributes; it is built from tables and inline styles because that is what survives Gmail, Outlook and Word.

Raw HTML pasted into an email shows as code. Tell the person how to carry it: save it as a file and open it in a browser (or view it rendered, if this app can render HTML), select the card, copy, and paste into the message or document. Give the plain text card alongside it for anywhere the formatting does not survive.

## After the card

If the person edits the document again in a way that changes a row, the card is stale. Offer to update it.

Do not put a card on a document unasked, and do not suggest that a missing card means anything about a piece of writing.
