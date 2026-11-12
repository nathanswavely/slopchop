# SlopChop card: prompts

## With the skill installed

Ask at the end of the session that produced the document, while the model can still see how it was made.

```
Make a SlopChop card for this report.
```

```
SlopChop card for this email, one line.
```

```
SlopChop card as HTML. I'm pasting it into Outlook.
```

```
I edited the draft in Word after our last pass. Here is the final version. Update the card.
```

```
I wrote this in another session. Ask me what you need and make a SlopChop card.
```

## Without the skill

Paste everything in the block below into any chat model, at the end of the session where you wrote the document. It makes the plain text and one-line cards. The HTML card needs `card.html` from this folder; attach it and ask for the HTML form.

```
Help me write a SlopChop writing card for the document we worked on in this conversation. It is a short self-reported note for the end of the document saying which parts of the work were mine and which were AI's. It is my statement, not your verdict: you lay out what you saw, propose a card, and I correct it.

Do this in order.

1. List what you saw happen to this document in this conversation: what I gave you (outline, notes, pasted text, sources, and roughly how much), what you drafted or proposed that was not in my material, what I changed by hand if you saw it, and what you did afterwards. Then list what you could not see: other sessions, other tools, edits I never showed you.

2. Propose a card and ask me two or three short questions about the gaps and the close calls. Do not flatter me. Choosing a topic is not the same as supplying the argument, and approving a section is not writing it. When torn between two values, propose the one that gives me less credit and say it was close.

3. When I answer, write the card I confirm. If my answer differs from what you saw, tell me once what you saw, then write what I say.

The card uses these rows in this order. Leave out a row when that job did not happen. Add no others.

Ideas: the argument and conclusions.
Research: finding the facts, sources and figures.
Draft: writing the first full version.
Edits: changing the draft into the final text.
Checked: reading the final text and standing behind it.
Words (optional): a ballpark of how much of the final wording is mine.

Ideas, Research, Draft and Edits take exactly one of: mine, mostly mine, shared, mostly AI, AI.
Checked takes one of: all of it, most of it, skimmed, not checked.
Words takes one of: nearly all mine, about three quarters mine, about half mine, about a quarter mine, almost none mine.

After a value I may add a note in my own words, a dozen words at most. No percentages. Never write verified, certified, audited or detected. The last line always starts with "Self-reported".

Format, exactly:

How this was written
Ideas: mine
Research: mostly mine, AI helped find sources
Draft: mostly AI, from my outline and notes
Edits: shared, I rewrote the summary and the findings
Checked: all of it
Words: about a quarter mine
AI used: Claude
Self-reported by MY NAME · SlopChop card

"AI used" is optional. If I give no name, the last line is "Self-reported · SlopChop card".

If I ask for one line instead, lead with the draft:

Written with AI: draft mostly AI, ideas and edits mine, all of it checked by me. Self-reported · SlopChop card
```
