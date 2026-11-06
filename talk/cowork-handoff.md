# Handoff: getting "Wading Through The Slop" out into the world

Context for a new Claude session (Cowork). It picks up from the session that built the talk. Read this first, then the files linked below as you need them.

## What happened

- **The talk.** Nathan Swavely gave "Wading Through The Slop: Building with AI in a world where people hate AI" on Oct 21, 2026, at the AI Unfiltered club at his coworking space. It ran about 20 minutes, with discussion afterwards. It covers transparency and consent when you build with AI for communities that distrust it, and ended with a live demo of SlopChop on nathanswavely.com.
- **Since then.**
  - The talk is on nathanswavely.com/work, in a new "Talks" section.
  - The slides are up at https://nathanswavely.com/talks/wading-through-the-slop.pdf (18 slides, main talk only).
  - Nathan finished reviewing his site's copy with SlopChop: every string has a decision, and 27% of the site's words are written by him (as of Oct 30).

## What's next

These are Nathan's priorities, in no fixed order:
- a Substack essay
- a LinkedIn post
- infographics
- other pieces that get the ideas and SlopChop in front of people

## How Nathan wants to work

**Who writes what:**
- **Substack essay:** he writes it himself. Help means outlines, fact-checks, structure, and pointing out lines that don't sound like him. Don't draft the essay unless he asks.
- **LinkedIn post and infographics:** he hasn't said. Ask whether he wants drafts or help with his own.

**Voice:**
- His nathan-voice skill is the reference, if it's installed.
- He reacted strongly to an early draft of the deck: "this whole deck feels like ai slop… patronizing voice… overexplaining."
- So avoid: not-X-but-Y lines, epigrams, coaching notes ("pause here", "let that land"), and overexplaining. Plain, specific, a bit wry.

**Process:**
- Ask one question at a time, and only when it changes what you do. He moves fast and says "go" when he means go.
- He edits deck artifacts himself in the page editor. Read the latest version before changing one.

**Disclosure:**
- This whole project argues for disclosing AI use, so every public piece should say how it was made.
- Substack now has a reader-side AI scanner (Pangram, since July 2026) and a "How I make this" disclosure setting. An essay about AI disclosure will get scanned. Keep his writing his, and fill in that setting accurately.
- Never mark SlopChop strings human / ai-fine / ai-revised on his behalf unless he has reviewed them and asks.

## Files (public, on GitHub)

All on branch `claude/ai-transparency-consent-talk-muncc1` of `nathanswavely/slopchop`:

- **Essay outline:** a section-by-section plan with evidence and sources, plus the two stories from the room. Start here for the Substack piece.
  https://raw.githubusercontent.com/nathanswavely/slopchop/claude/ai-transparency-consent-talk-muncc1/talk/essay-outline.md
- **Full speaker notes:** prose notes for every slide, in the current order, with timings.
  https://raw.githubusercontent.com/nathanswavely/slopchop/claude/ai-transparency-consent-talk-muncc1/talk/speaker-notes.md
- **Research report:** which claims hold up, who disagrees, what's original, the verification table and the full source list.
  https://raw.githubusercontent.com/nathanswavely/slopchop/claude/ai-transparency-consent-talk-muncc1/reports/AI%20consent%20and%20disclosure%20landscape.md
- **Research notes:** five topic files under `research_notes/AI consent and disclosure landscape/`:
  - consent_and_training
  - counterarguments
  - public_opinion
  - disclosure_and_trust
  - builders_and_existing_writing
- **SlopChop itself:** https://github.com/nathanswavely/slopchop. The README has screenshots.
- **The deck:** a claude.ai Slides artifact, https://claude.ai/artifact/642M8o5CaphS7vJm5oju9v (private to Nathan). The PDF above is the shareable version.

## The argument, in one line

Saying you used AI costs you trust right now, getting caught costs more, and the cost only drops once enough people disclose, so builders who want creative communities to trust them have to go first and pay it.

## Numbers that were checked against the primary sources

| Claim | Figure | Source |
|---|---|---|
| Disclosure lowers trust | Lowered trust in all 13 experiments. Tax advisor (Study 13, N=195): said nothing 50%, disclosed 36%, caught 25% (% of max on a 1–7 scale; raw 4.02 / 3.15 / 2.49) | Schilke & Reimann 2025, "The Transparency Dilemma: How AI Disclosure Erodes Trust," *OBHDP* |
| Norms shrink the penalty | Framing AI use as normal cut the penalty by about a third (Study 7, N=426) | Same paper |
| Makers vs. managers | 52% of 2,300+ games professionals say gen AI is bad for the industry, 7% good. Art 64%, design 63%, programming 59% bad. Execs and business staff 19% good. "Mixed" fell from 51% to 30% in a year. "Bad" rose 18% → 30% → 52% over 2024–26 | GDC 2026 State of the Game Industry |
| Party lines | More concerned than excited: Democrats 46% → 56% since 2023, Republicans 59% → 49% | Pew, June 22–28, 2026 |
| Can't hear it, still care | 97% couldn't pick AI music in a blind test, 80% want it labeled, 73% say training without asking is unethical | Deezer / Ipsos, 9,000 adults in 8 countries, Oct 6–10, 2025 |

Not yet verified (check before using in print):
- the arXiv study saying short disclosures beat long ones (2601.09620)
- the chess-engine analogy timeline
- Robin Sloan's "Is it okay?", which has to be read before calling "influence follows reach" new

## What's Nathan's

The research found no one else making these arguments, which is weaker than proving no one has:
- **Influence follows reach.** Getting copied used to pay you back in audience. Training copies everyone, pays nothing, then competes with them.
- **The byline as a promise.** Author consent, the third of his three consents (source, audience, author).
- **The Closeted User persona.** Uses AI privately and hides it publicly. Part of his six personas: Refuser, Quality Skeptic, Wary Pragmatist, Indifferent, Enthusiast, Closeted User.
- **Makers vs. managers.** His hypothesis that working with AI is management, so it hands managers making back and turns makers into managers. Label it a hypothesis, since nobody has polled AI attitudes by job.
- **The builder's options,** in three groups:
  - what's in it: keep AI out of what they touch
  - what you say: built with AI vs. AI inside, and say what it won't do
  - who you launch with: the Pragmatists and the community
  - plus "sometimes not yet"
- **SlopChop:** per-string, self-reported copy provenance, with an "ai-fine" status no other scheme has.

Borrowed, and to be credited: "consent, credit, compensation" is the creative community's language (Karla Ortiz, the Statement on AI Training, Fairly Trained).

## The case studies

- **The Lancaster Loop (r/lancaster).** A newcomer's free local newsletter said "no AI-bots used." Commenters said it "reeks of AI." The author answered "are you a bot?" when the question was "did you use AI?", and called generated images a "grammar editor." The use was forgivable, the claim wasn't. The thread is public. Whether to name or quote the author in a given piece is Nathan's call.
- **The Discord tool (from the discussion).** Someone in the room built an efficiency tool for a Discord server. He said accurately that it was built with AI help, not an AI tool and not trained on anyone's data, and still got a backlash, with flat adoption at first. He kept shipping and stayed present as a person, and adoption picked up once people saw it was useful. Get his permission and a few details (how long it was flat, a number or two) before using it.
- **The open question from the discussion.** An Enthusiast argued that AI will soon be better than people at a lot of things, which changes the social contract. How do you negotiate that once it's inarguably better? Leave it open and invite replies.

## Open items

- [ ] Permission and details from the Discord builder
- [ ] Read Robin Sloan's "Is it okay?"
- [ ] Verify the arXiv disclosure-length study and the chess timeline
- [ ] Decide whether SlopChop gets its own card under "Things I've built" on nathanswavely.com (it would also appear on /dev with its own description)
- [ ] Link the essay from the /work Talks card once it's published
