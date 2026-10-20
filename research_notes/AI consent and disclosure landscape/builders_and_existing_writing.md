# Builders vs. anti-AI sentiment, "human-made" provenance tools, and existing writing on Nathan's themes (as of Oct 2026)

Research method note: ~20 web searches, run 2026-10-20. Most findings come from search-result summaries of news and secondary coverage rather than full-page fetches of primary sources, so exact wording and dates should be spot-checked before quoting on stage. Items I know only from background knowledge (not verified this session) are confined to the Gaps sections and flagged.

## Q1. Company positioning cases: what happened, what lessons, which "won't do" commitments built trust

### Takeaway
The pattern is consistent: companies that made specific, verifiable **negative commitments** ("we will not add genAI," "we don't train on your content," "no AI music on the platform") got goodwill or at least defused a crisis, while companies that **shipped or used** genAI around artists without consent or disclosure (DeviantArt DreamUp, Wacom, Wizards of the Coast, Figma Make Designs, Adobe's vague ToS) were punished fast and publicly, often via one viral post. Vendor/third-party excuses ("it came from an agency," "it crept in through Photoshop") did not protect the brand.

### Cited Findings

**Procreate (Aug 2024) — the strongest "won't do" case**
- Procreate posted a page titled "AI is not our future" and pledged never to add generative AI features to its products — [TechCrunch, 2024-08-19](https://techcrunch.com/2024/08/19/procreate-takes-a-stand-against-generative-ai-vows-to-never-incorporate-the-tech-into-its-products)
- CEO James Cuda posted a video saying he strongly dislikes generative AI (headline quote: "I fuc**ng hate generative AI"), framing it as built on taking artists' work — [TechSpot](https://www.techspot.com/news/104354-fing-hate-generative-ai-procreate-vows-never-use.html); [Upworthy](https://www.upworthy.com/top-digital-art-app-takes-a-firm-stand-for-human-creativity-refuses-to-add-ai-tools/)
- Reception: widespread praise from digital artists — [Dataconomy, 2024-08-20](https://dataconomy.com/2024/08/20/procreate-draws-the-line-no-ai-allowed-in-their-creative-tools/). TechRadar noted not all artists share the view given rapid AI adoption elsewhere — [TechRadar](https://www.techradar.com/computing/artificial-intelligence/hate-ai-art-youre-gonna-love-what-procreate-just-promised-to-do-or-not-do)
- Skeptical analysis: stance may be hard to sustain if a rival ships "ethically developed" genAI, but Procreate's focus (painting/illustration) means genAI's benefit to its users is limited anyway — [Yahoo Tech](https://tech.yahoo.com/general/articles/procreate-gives-visual-artists-reason-173143127.html)

**Cara (June 2024) — growth from being anti-AI**
- Cara (artist-run; launched Jan 2023) jumped from ~40k to ~650k users in about a week in June 2024, topping App Store charts — [TechCrunch via Lemmy repost](https://lemmy.world/post/16253969); [TechCrunch](https://techcrunch.com/?p=2790719). Later accounts say >1M within weeks — [Creative Bloq](https://www.creativebloq.com/art/digital-art/the-rise-of-cara-the-anti-ai-social-media-platform-for-artists)
- Trigger: Meta's plan to train genAI on public posts from 2024-06-26, with opt-out only for EU users — [Wikipedia: Cara (app)](https://en.wikipedia.org/wiki/Cara_(app))
- Cara's "won't do" stack: bans AI art from portfolios (uses detection, Hive moderation), auto-adds NoAI tags, integrates Glaze — [My Modern Met](https://mymodernmet.com/cara-artist-social-media-platform/); [Creative Bloq](https://www.creativebloq.com/art/digital-art/the-rise-of-cara-the-anti-ai-social-media-platform-for-artists)
- Fragility: volunteer-run, founder-funded; crashes from load; critique that it's artists talking to artists, without a non-artist audience — [Entrepreneur](https://www.entrepreneur.com/business-news/anti-ai-app-booming-in-popularity-as-artists-leave-instagram/475255); [Wikipedia](https://en.wikipedia.org/wiki/Cara_(app))
- Irony worth noting for the talk: Cara, an anti-AI platform, itself uses AI (Hive's detection) to enforce its stance — [Wikipedia](https://en.wikipedia.org/wiki/Cara_(app)) (inference about irony is mine)

**Adobe (June 2024 ToS backlash; Firefly "commercially safe")**
- Backlash centered on ToS language read as letting Adobe access user content "through automated and manual means"; one viral tweet reportedly drew >5M views — [Stratrix case study](https://www.stratrix.com/crisis-response/adobe-s-ai-and-creator-backlash); [Slate, June 2024](https://slate.com/technology/2024/06/adobe-terms-use-backlash-licensing-royalty-generative-ai-creative-cloud.html)
- Adobe blog clarifications June 6 and 10, 2024: does not train AI on customer content, does not claim ownership — [Malwarebytes](https://www.malwarebytes.com/blog/news/2024/06/no-ai-training-in-newly-distrusted-terms-of-service-adobe-says). Revised terms: sources disagree on date (June 18 vs June 24, 2024) — [CG Channel](https://www.cgchannel.com/2024/06/adobe-updates-its-terms-of-use-following-artist-backlash/)
- Revised terms include: "we will not use your local or cloud content to train generative AI models except for content you choose to submit to the Adobe Stock marketplace" — [CG Channel](https://www.cgchannel.com/2024/06/adobe-updates-its-terms-of-use-following-artist-backlash/)
- Some commentary argues the inflammatory clause wasn't new — [Stratrix](https://www.stratrix.com/crisis-response/adobe-s-ai-and-creator-backlash) (single-source reading)
- Lesson framing: vague legal language + low trust = worst-case interpretation; an explicit plain-language "won't" was the remedy — [Trustlab](https://www.trustlab.com/post/lessons-from-adobes-updated-terms-of-use-controversy)

**Figma "Make Designs" (July 2024)**
- Figma disabled Make Designs after a user showed it produced near-copies of Apple's Weather app; CEO Dylan Field blamed a QA gap in the underlying design system and denied the tool was trained on existing apps — [TechCrunch, 2024-07-02](https://techcrunch.com:443/2024/07/02/figma-disables-its-ai-design-feature-that-appeared-to-be-ripping-off-apples-weather-app); [404 Media](https://www.404media.co/figma-disables-ai-app-design-tool-after-it-copied-apples-weather-app/); [TechCrunch, 2024-07-06](https://techcrunch.com/2024/07/06/figma-pauses-its-new-ai-feature-after-apple-controversy)
- Relaunched Sept 2024 as "First Draft" with four libraries (wireframe to hi-fi) — [AlternativeTo, Sept 2024](https://alternativeto.net/news/2024/9/figma-relaunches-ai-powered-first-draft-app-generator-after-initial-backlash-over-fraud)

**Wacom and Wizards of the Coast / Magic: The Gathering (Jan 2024)**
- Wacom promoted Intuos tablets with a dragon image showing AI tells; deleted it without immediate comment, later blamed a third party — [PetaPixel, 2024-01-10](https://petapixel.com/2024/01/10/wacom-enraged-customers-by-using-ai-art-but-says-its-not-to-blame); [80.lv](https://80.lv/articles/wacom-explained-its-ai-generated-images-after-backlash)
- Wizards first insisted a human made an MTG marketing image, then a day later apologized: AI components "that are now popping up in industry standard tools like Photoshop crept into our marketing creative"; it came from a vendor; "it's on us"; would update guidelines — [TechRadar](https://www.techradar.com/gaming/wizards-of-the-coast-admits-that-we-made-a-mistake-after-ai-art-confusion); [iTechPost, 2024-01-07](https://www.itechpost.com/articles/120474/20240107/magic-gathering-owners-apologizes-ai-components-marketing-image.htm); [Aftermath](https://aftermath.site/wizards-coast-magic-apex-legends-ai-art-wacom.md)
- Lesson: these companies' customers ARE artists; even incidental AI in marketing reads as betrayal; denial-then-reversal compounds damage.

**DeviantArt DreamUp (Nov 2022)**
- DreamUp (Stable Diffusion–based) launched; core grievance was that users' art was in scope for training without explicit consent — [Synthedia](https://synthedia.substack.com/p/deviant-art-bans-ai-models-from-using); [artnet](https://news.artnet.com/art-world/independent-artists-are-fighting-back-against-a-i-image-generators-with-innovative-online-protests-2231334)
- After protest, DeviantArt said all deviations are automatically labeled NOT authorized for AI datasets, using `noai`/`noimageai` directives (flipping to opt-in) — [Synthedia](https://synthedia.substack.com/p/deviant-art-bans-ai-models-from-using)

**ArtStation "No to AI Generated Images" (Dec 2022)**
- AI images hit ArtStation's homepage early Dec 2022; Alexander Nanitchkov posted the first graphic on 2022-12-05; Nicholas Kole helped spread it; ArtStation removed protest images citing ToS, which intensified it — [Dataconomy, 2022-12-20](https://dataconomy.com/2022/12/20/no-to-ai-generated-images-artstation/); [artnet](https://news.artnet.com/art-world/independent-artists-are-fighting-back-against-a-i-image-generators-with-innovative-online-protests-2231334)
- Single unverified source claims ArtStation made NoAI the default in Sept 2026 — [banthebots.org](https://www.banthebots.org/explainers/deviantart-alternatives) (treat as unverified)

**Kickstarter, Patreon, Bandcamp, Spawning**
- Kickstarter (Aug 2023): projects using genAI must disclose additional info on how AI is used and training-data consent — [TechCrunch, 2023-08-01](https://techcrunch.com/2023/08/01/kickstarter-requires-generative-ai-projects-to-disclose-additional-info/amp/)
- Patreon: guidelines prohibit taking other creators' works to train AI; 2023 policy update blocked scraping for model training — [Patreon guidelines](https://www.patreon.com/policy/guidelines); [Patreon 2023 year-end policy update](https://news.patreon.com/articles/2023-year-end-update-from-the-policy-team)
- Bandcamp (2026-01-13): bans music generated "wholly or in substantial part" by AI and AI impersonation of artists/styles; enforcement via user reports; described as first major music platform to do so — [TechCrunch, 2026-01-14](https://techcrunch.com/2026/01/14/bandcamp-takes-a-stand-against-ai-music-banning-it-from-the-platform/); [Billboard](https://www.billboard.com/pro/bandcamp-bans-ai-generated-music-songs-policy/); [Music Business Worldwide](https://www.musicbusinessworldwide.com/bandcamp-bans-ai-generated-music-we-want-musicians-to-keep-making-music/)
- Spawning: Have I Been Trained (search LAION-5B) + Do Not Train Registry, honored voluntarily by partners incl. Stability AI and Hugging Face; features partially unavailable Feb 2024; status described as "transitional" in 2026 — [Spawning blog, Feb 2024](https://spawning.substack.com/p/have-i-been-trained-is-back); [datalicenses.org](https://datalicenses.org/initiatives/do-not-train-registry/); [MIT Tech Review, 2024-11-21](https://www.technologyreview.com/2024/11/21/1107108/four-ways-to-protect-your-art-from-ai/)

**Broader backdrop**
- MIT Tech Review (2026-04-21) describes a cross-partisan populist AI backlash (data center bills, jobs, teen mental health, copyright), including a "Pro-Human AI Declaration" signed in March 2026 by MAGA Republicans, democratic socialists, labor and church leaders — [MIT Technology Review](https://www.technologyreview.com/2026/04/21/1135665/resistance-ai-artificial-intelligence-backlash-protests/)
- Brian Merchant, "Why the AI backlash has turned violent" — [Blood in the Machine](https://www.bloodinthemachine.com/p/why-the-ai-backlash-has-turned-violent) (date not captured)

### Inferences
- Trust-building "won't do" commitments share three features: (1) specific (no genAI features; no training on your content; no AI music), (2) about the user's own work or the audience-facing surface, (3) cheap to verify or at least easy to catch violations of. Procreate, Bandcamp, Cara, Adobe's post-crisis ToS line all fit. This maps closely onto Nathan's "state what the tool won't do" and "keep AI out of what the audience touches" — these are well-supported by precedent, not novel per se, but nobody I found has codified them as a builder's playbook.
- Nathan's "built with AI vs. AI inside the product" distinction is implicitly tested by Wizards/Wacom: the audience did not care that AI was a vendor's process detail; it touched the audience-facing surface (marketing art). That suggests the line that matters is "what the audience touches," not "what the product contains." Good evidence for his framing.
- Nobody in the cases above publicly said "we used AI to build this tool, but it contains none" — Procreate and Cara are silent on whether their own engineers use coding assistants. That is a genuine gap SlopChop-style disclosure addresses.
- Cara using AI detection to enforce anti-AI is a neat illustration that "AI vs. no AI" is not the operative line; consent and audience-facing output are.

### Gaps
- Did not verify Procreate's exact page text or any later (2025–26) Procreate statements; did not find user-number or revenue impact data for Procreate.
- Cara's 2025–2026 user numbers/status not found.
- Did not verify Adobe Firefly's "commercially safe" marketing claims or the 2024 Bloomberg reporting that Firefly training included some Midjourney-generated Adobe Stock images (background knowledge, unverified this session).
- No reliable 2026 Patreon general AI policy found; one source alleging a 2026 enforcement sweep (aiidentifiers.com) is unverified.

## Q2. Tools/standards similar to SlopChop; is anyone doing per-string self-reported provenance for site/app copy?

### Takeaway
There is a crowded field of **whole-work** human-made labels (Authors Guild "Human Authored," Not By AI badges), **machine-readable signals** (C2PA, noai tags, a draft IETF AI-Disclosure header), **detection guides** (Wikipedia's Signs of AI writing), and **contribution policies** in open source (Ghostty, Gentoo, NetBSD, curl). I found **nothing doing per-string, self-reported provenance for website/app UI copy**; the closest are a commercial WordPress plugin with per-content "human-crafted/AI-assisted" icons and C2PA's new AI-disclosure assertion (not text-granular). SlopChop's granularity and its explicit "not a detector" self-report stance appear original.

### Cited Findings

**Human-made labels**
- Authors Guild "Human Authored" certification: launched ~Jan/Feb 2025 as a portal to certify books from "human intellect"; allows minor AI use (spell-check, research); self-certified; reportedly opened to all US-published authors/publishers in March 2026; one comparison lists it free for members, $10/title otherwise, ~6,500 titles — [Euronews, 2025-02-04](https://euronews.com/culture/2025/02/04/us-authors-guild-sets-up-portal-to-certify-books-from-human-intellect-and-not-ai); [Yahoo](https://www.yahoo.com/news/authors-guild-sets-human-author-233820443.html); [progressiverobot.com, 2026-10-10](https://www.progressiverobot.com/2026/10/10/human-authored-book-labels-gain-ground-ai-scandals/) (latter figures single-source)
- Critics: self-certification makes the marks easy to counterfeit — [progressiverobot.com](https://www.progressiverobot.com/2026/10/10/human-authored-book-labels-gain-ground-ai-scandals/); [Brooke Warner Substack](https://brookewarner.substack.com/p/human-authored)
- Not By AI: free self-applied badges (Written/Painted/Produced By Human) with a self-assessed rule that ≥90% of content is human-made; no legal significance; critics note it's unverifiable — [Website Planet interview](https://www.websiteplanet.com/blog/notbyai-interview); [Hackaday tag](https://hackaday.com/tag/not-by-ai); [bearblog critique "Sought by AI"](https://imperfect.bearblog.dev/sought-by-ai/)

**Machine-readable / standards**
- C2PA/Content Credentials is mainly image/video/audio; credentials are stripped by upload pipelines; standard doesn't judge truth of provenance data; C2PA has published an "AI disclosure assertion" capturing model provenance and degree of human oversight — [c2pa.org implementation guide](https://c2pa.org/a-new-implementation-guide-for-content-credentials/); [TrueScreen](https://truescreen.io/articles/c2pa-standard-history-limitations/)
- OpenAI says text provenance uses watermarking of word-choice randomness (EU), not C2PA manifests — [OpenAI help](https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content)
- IETF individual Internet-Draft (Apr 2025) proposes an `AI-Disclosure` HTTP response header — response-level, aimed at machines, not adopted — [IETF draft-abaris-aicdh-00](https://www.ietf.org/archive/id/draft-abaris-aicdh-00.html)
- EU AI Act Article 50 transparency obligations applied from 2026-08-02; compliance guidance says a "how we use AI" page is supplementary and per-page badges generally unnecessary for AI-assisted text (rule of thumb: label what a user could mistake for human) — [soxdomains](https://www.soxdomains.com/blog/ai-labelling-rules-websites-eu-ai-act); [Jimdo](https://www.jimdo.com/blog/ai-labelling-obligation-website/)
- Commercial: Aithenticate WordPress plugin — disclosure generator and icons marking content as human-crafted or AI-assisted (not open source) — [G2](https://www.g2.com/products/aithenticate/discuss)
- Opt-out tags: DeviantArt `noai`/`noimageai` — [Synthedia](https://synthedia.substack.com/p/deviant-art-bans-ai-models-from-using)

**Detection/cleanup**
- Wikipedia WikiProject AI Cleanup: volunteer effort against unsourced/poor AI content, not a ban on AI; its "Signs of AI writing" field guide (~15,000 words; advice, not policy) catalogs tells ("stands as a testament," em-dash overuse, promotional tone) and warns no single sign is proof and against relying on detectors — [The Decoder](https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/); [404 Media](https://404media.co/the-editors-protecting-wikipedia-from-ai-hoaxes); [erkansaka.net, 2025-09-27](https://erkansaka.net/2025/09/27/wikipedia-signs-of-ai-writing-guide/)

**Open-source contribution policies**
- Ghostty required disclosure of AI assistance beyond tab-completion in PRs (Aug 2025) — [BigGo, 2025-08-22](https://biggo.com/news/202508220113_Ghostty_Requires_AI_Disclosure_in_Pull_Requests); reportedly found disclosure insufficient and in Jan 2026 restricted AI-assisted contributions to pre-approved issues/maintainers, with a vouch system — [Open {re}Source](https://openresource.dev/articles/ai-slop-contribution-policy); [codenote.net](https://codenote.net/en/posts/oss-ai-slop-contribution-policy-shift/) (sources vary on dates — verify against Ghostty's CONTRIBUTING)
- Gentoo banned AI-generated contributions (April 2024); NetBSD treats LLM code as "tainted," requiring core sign-off; rationale is licensing/DCO — [Open {re}Source](https://openresource.dev/articles/ai-slop-contribution-policy)
- curl: from 2025-05-06 Daniel Stenberg banned reporters of AI-slop security reports; ended bug bounty Jan 2026 — [RedMonk, 2026-02-03](https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/); [InfoQ, Feb 2026](https://www.infoq.com/news/2026/02/ai-floods-close-projects/)
- Policy taxonomy: outright bans (NetBSD, Gentoo, QEMU, Zig, GIMP) vs. human-in-the-loop disclosure + accountability (Linux kernel, LLVM, Fedora, WordPress, Mastodon, EFF); tldraw auto-closes external PRs — [Open {re}Source](https://openresource.dev/articles/ai-slop-contribution-policy)

### Inferences
- SlopChop sits in an empty niche: per-string, developer-self-reported, multi-category (human / ai-fine / ai-revised / rewritten) provenance for audience-facing copy. Existing labels are binary-ish and whole-work (Not By AI's 90% rule; AG's book-level cert); C2PA is file-level and image-centric; OSS policies govern contributions in, not copy out.
- SlopChop's "explicitly not a detector" stance aligns with Wikipedia's own warning against detectors, and with the critique that all self-cert badges are unverifiable — SlopChop can lean into this: it's a ledger of claims, auditable because per-string, rather than a certificate. The per-string granularity makes a lie more specific (and thus more costly) than a blanket badge.
- The "ai-fine" category is distinctive: none of the label schemes I found have a category for "AI was used and that's acceptable here," which matches Nathan's "negotiated etiquette" theme.
- Ghostty's arc (disclosure → disclosure insufficient → gatekeeping) is a cautionary precedent for disclosure schemes where incentives to under-report exist.

### Gaps
- Could not confirm whether any i18n/copy-management tool (e.g., Crowdin, Lokalise, Ditto) has added per-string AI-provenance fields; worth a targeted check.
- Did not find "ai.txt" specifics (Spawning proposed an ai.txt in 2023 per background knowledge; unverified this session) or llms.txt relationship.
- Did not fetch Ghostty's/Gentoo's primary policy docs; dates from secondary sources.
- "Human-written %" analytics tools beyond detectors (GPTZero, Originality.ai) not researched.

## Q3. Simon Willison on slop and disclosure; other prominent technologists on ethics of building with AI for creatives

### Takeaway
Willison's May 2024 post framed slop as AI content that is **unrequested and unreviewed**, and made "don't publish slop" a personal-ethics baseline — closely adjacent to SlopChop's "review every string" mechanic. Brian Merchant is the most prominent labor/Luddite voice on artists. I could not verify in-session the specific pieces by Mollick, Sloan, Appleton, Bjarnason, Zitron, Dash.

### Cited Findings
- Willison, "Slop is the new name for unwanted AI-generated content," 2024-05-08: credits @deepfates; slop = unrequested and unreviewed; "not all promotional content is spam, and not all AI-generated content is slop"; he uses LLMs but won't publish output without review; "don't publish slop" as baseline personal AI ethics — [simonwillison.net](https://simonwillison.net/2024/may/8/slop); amplified by [Daring Fireball, 2024-05-08](https://daringfireball.net/linked/2024/05/08/slop) and [Ben Werdmuller](https://werd.io/slop-is-the-new-name-for-unwanted-ai-generated-content/)
- Willison's slop tag continues into 2026 (e.g., AI-written GitHub issues) — [simonwillison.net/tags/slop](https://simonwillison.net/tags/slop)
- Brian Merchant / Blood in the Machine: AI, tech, labor and power; "tens of thousands" of subscribers per its About page; named after his 2023 Luddite book; covers artists' fights ("The artists fighting to save their jobs and their work from AI are gaining ground") — [About](https://www.bloodinthemachine.com/about); [post](https://substack.com/@bloodinthemachine/p-147769751)
- Merchant note: "I am sorry you cannot trust me, but I assure you I have never used AI to compose a single sentence" — illustrates the trust/suspicion burden even on anti-AI writers — [Substack note](https://substack.com/@bloodinthemachine/note/c-286315807)
- Molly White quoted: AI "can be kind of useful, but I'm not sure that a 'kind of useful' tool justifies the harm" — via [context.center aggregator](https://context.center/topics/generative-ai-and-chatgpt/) (secondary; original likely her Citation Needed essay)
- Anil Dash, "Today's AI is unreasonable" listed as covering AI's effect on artists — [context.center](https://context.center/topics/generative-ai-and-chatgpt/) (date/argument unverified)
- Scientific American: people who know more about AI art's back end find it less ethical — [SciAm](https://www.scientificamerican.com/article/people-who-know-more-about-ai-art-find-it-less-ethical/)

### Inferences
- Willison's "unreviewed" criterion is the conceptual ancestor of SlopChop's mark-each-string workflow; Nathan should cite him and position SlopChop as "operationalizing review" rather than claiming the slop/review idea is new.
- The Merchant note shows disclosure burden now falls on everyone, including people who don't use AI — supports Nathan's "new social dividing line" framing.

### Gaps (background knowledge, NOT verified this session — check before citing)
- Molly White, "AI isn't useless. But is it worth it?" (Citation Needed, ~April 2024).
- Robin Sloan, "Is it okay?" (robinsloan.com, ~Feb 2025) on whether training on everything is okay — highly relevant to consent framing.
- Ethan Mollick's "secret cyborgs" concept (One Useful Thing, 2023) — directly relevant to closeted AI use.
- Ted Chiang, "Why A.I. Isn't Going to Make Art" (New Yorker, ~Aug 31 2024).
- Baldur Bjarnason, *The Intelligence Illusion* and blog writing; Ed Zitron (Where's Your Ed At); Maggie Appleton talks on AI and the web — none verified this session.

## Q4. Existing pieces on AI as culture war / social cleavage, AI etiquette, AI shame, code vs. art attitudes

### Takeaway
"AI shame" is well-documented with survey data (2024–2026); "AI etiquette" pieces exist but are small blog/advice columns; the code-vs-art asymmetry is a recurring HN debate with standard explanations (consent/licensing, means vs. end, threat level). I found **no prominent, most-cited essay** that frames AI as a new social cleavage *lacking negotiated etiquette* the way Nathan does — existing "culture war" framings are mostly Medium/Substack opinion or MIT Tech Review's backlash reporting.

### Cited Findings

**AI shame / closeted use**
- Microsoft/LinkedIn 2024: 52% of AI users reluctant to admit using it for important tasks — [The Decoder](https://the-decoder.com/ai-shame-at-work-is-a-thing-according-to-a-microsoft-study/)
- Slack Fall 2024 Workforce Index: reasons for hiding — feels like cheating (47%), look less competent (46%), look lazy (46%) — via [Chatbot Genius](https://thechatbotgenius.com/blog/ai-shame-workplace-readiness-gap.html) (secondary)
- WalkMe (Sept 2025): 49% hid AI use; Cornerstone (Nov 2025): 57% US / 81% UK reluctant to disclose, attributed to lack of training, not shame — [BusinessWire, 2025-11-19](https://secure.businesswire.com/news/home/20251119025171/en/Hidden-AI-Lack-of-Training-Keeps-AI-Use-in-the-Shadows-Despite-AI-Usage-Encouragement-From-Employers) (findings conflict on cause)
- Duke/PNAS 2025: AI users rated lazier, less competent; penalty vanishes when the evaluator uses AI — cited in [arXiv 2603.07459](https://arxiv.org/pdf/2603.07459) and [Chatbot Genius](https://thechatbotgenius.com/blog/ai-shame-workplace-readiness-gap.html)
- Nieman Lab (Sept 2026): lack of professional AI guidelines produces "AI shame" — [Nieman Lab](https://www.niemanlab.org/2026/09/a-lack-of-professional-ai-guidelines-leads-to-feelings-of-ai-shame-a-new-study-finds/)
- arXiv 2026 paper "Better Ask for Forgiveness than Permission": AI disclosure practices and policies in freelance work — [arXiv 2603.07459](https://arxiv.org/pdf/2603.07459)
- arXiv 2025: "What Shapes Writers' Decisions to Disclose AI Use?" — [arXiv 2505.20727](https://arxiv.org/html/2505.20727v1)

**Etiquette / disclosure norms**
- Steve Fenton, "AI Etiquette" (Sept 2026): polishing someone's work through AI is disrespect; reviewer burden; "disclosure error" as a failing — [stevefenton.co.uk](https://stevefenton.co.uk/blog/2026/09/ai-etiquette/)
- Dataversity "Ask a Data Ethicist": norms unsettled; ask consent before bringing AI assistant into meetings — [Dataversity](https://www.dataversity.net/articles/ask-a-data-ethicist-what-is-the-appropriate-etiquette-when-using-ai-tools/)
- "AI, Applied Part 5: Disclosure in the AI Era" (Substack, ~mid-2026) uses sponsored-content disclosure as precedent — [architectureofwork.substack.com](https://architectureofwork.substack.com/p/ai-applied-part-5-disclosure-in-the)

**Culture war / cleavage framings**
- MIT Tech Review (2026-04-21) "Resistance": cross-partisan backlash coalition — [MIT TR](https://www.technologyreview.com/2026/04/21/1135665/resistance-ai-artificial-intelligence-backlash-protests/)
- Folio Weekly (2026-06-01) "AI Art Wars: The Internet's Dumbest Creative Civil War" — [Folio Weekly](https://folioweekly.com/2026/06/01/ai-art-wars-the-internets-dumbest-creative-civil-war/)
- Medium essays "The AI Culture War: A Struggle Over Who Gets to Matter" — [Medium](https://medium.com/@Wfh.iii/the-ai-culture-war-5e54e5a675fb); Nettrice Gaskins "'AI Art Slop' & The Cultural Wars" — [Medium](https://nettricegaskins.medium.com/ai-art-slop-the-cultural-wars-90b7947060e8); "Won't Get Fooled Again: On aesthetic morality and neo-luddism" — [Substack](https://herbsundays.substack.com/p/wont-be-fooled-again-on-aesthetic)

**Code vs. art**
- HN "Ask HN: Why do we celebrate AI-Copilots but reject AI-Generated art?" (2025): explanations — code is means, art is end; permissive code licenses blunt consent objection; open-source culture accepts automation; code is verifiable — [HN 43806291](https://news.ycombinator.com/item?id=43806291); also [HN 46991814](https://news.ycombinator.com/item?id=46991814); [DEV](https://dev.to/zeedu_dev/ai-generated-art-and-ai-generated-code-are-treated-differently-agh)
- UC Berkeley CLTC white paper (Oct 2024): creators resisting text-to-image tools reduce online visibility to avoid scraping — [CLTC](https://cltc.berkeley.edu/publication/resistance-to-text-to-image-generators-in-creator-communities/)
- Counterpoint: OSS developers are now themselves revolting against AI slop (Gentoo, curl, Ghostty) — the asymmetry is narrowing — [RedMonk](https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/)

### Inferences
- Nathan's "new social dividing line without negotiated etiquette" is adjacent to (a) AI-shame survey literature and (b) small etiquette posts, but I found no flagship essay synthesizing it as a social-norms problem specifically between builders and creative communities. Moderately original; he should cite the shame data (Slack/PNAS) as evidence.
- The code-vs-art asymmetry is well-trodden on HN; Nathan's value-add would be the 2025–26 twist that developers are now experiencing the slop problem in their own commons, making the asymmetry less about values and more about whose commons got flooded first.

### Gaps
- No prominent Atlantic/Verge/New Yorker essay on "AI as culture war" surfaced; may exist (search did not target by outlet).
- Did not verify Mollick's "secret cyborgs" piece (closest canonical text on closeted use).

## Q5. Consent tied to the "influence/fame bargain" / reciprocity — originality check

### Takeaway
The consent framing of AI-art objections is mainstream (consent is artists' #1 concern in surveys). The "human influence vs. machine training differ in scale/intent/norms" argument is common. I found **no source framing it as Nathan does — that influence is a bargain where reach/attribution flows back to the influenced-from ("influence follows reach")**. That specific reciprocity/fame-bargain formulation appears original, though Herndon/Dryhurst and Robin Sloan (unverified) are close neighbors.

### Cited Findings
- Survey: artists' top concerns — lack of consent 70%, misattribution 64%, market displacement 58%; want licensing, opt-out, participatory governance — [IntechOpen chapter](https://www.intechopen.com/chapters/1238321)
- Harry Jiang et al. (AIES 2023): calling generators "inspired" like human artists is misguided and harmful — [ACM](https://dl.acm.org/doi/pdf/10.1145/3600211.3604681)
- Holly Herndon & Mat Dryhurst (ArtReview): human collage vs. "spawning" (automated endless works in someone's style); consent framing — [ArtReview](https://artreview.com/ai-art-and-the-problem-of-consent/)
- Human learning happens within understood cultural norms (public sharing, education, mentorship) — [Simply Put Psych](https://simplyputpsych.co.uk/global-psych/learning-to-steal-ai-art-and-the-thin-line-between-influence-and-infringement)
- "AI Art is Theft: Labour, Extraction, and Exploitation" — systematic violation of artists' autonomy — [arXiv 2401.06178](https://arxiv.org/html/2401.06178v2)
- Yale LJ Forum: copyright may be the wrong tool for consent/attribution/compensation — [YLJ](https://yalelawjournal.org/pdf/MantegnaYLJForumEssay_w3bfyyp8.pdf)
- >6,000 artists protested training without consent; more knowledge of the back end → less comfort — [SciAm](https://scientificamerican.com/article/people-who-know-more-about-ai-art-find-it-less-ethical/)

### Inferences
- "Influence follows reach" adds an economic/social-exchange mechanism (attribution, audience, career reciprocity) that the scale/intent arguments lack; it explains why the same act (learning from public work) is fine for humans — the influencer gains reach via lineage/credit — and not for models, which absorb without returning reach. Worth presenting as his contribution, with Herndon/Dryhurst and Jiang cited as context.

### Gaps
- Did not check Robin Sloan's "Is it okay?" (2025), which may discuss a reciprocity/"commons" framing — highest originality risk; verify.
- Did not check Kirby Ferguson ("Everything is a Remix") or Austin Kleon ("Steal Like an Artist") responses to AI, which may touch credit/lineage norms.

## Q6. Substack/newsletter niches at AI × creativity × ethics

### Takeaway
The niche is populated mainly by critical/labor voices (Merchant) and many small creator-side Substacks; I could only confirm audience size for Merchant ("tens of thousands"). A builder-perspective post ("I built a tool for creatives with AI; here's the etiquette I propose") seems under-served relative to critic and pure-practitioner voices.

### Cited Findings
- Blood in the Machine (Brian Merchant): tens of thousands of subscribers; AI, labor, artists — [About](https://www.bloodinthemachine.com/about)
- Simon Willison's weblog (not Substack, but newsletter edition) — dominant practitioner voice on slop — [simonwillison.net](https://simonwillison.net/tags/slop)
- Many small Substacks on human-authored labels and creative resistance: [Brooke Warner](https://brookewarner.substack.com/p/human-authored); [queensmuse "human certified"](https://queensmuse.substack.com/p/human-certified); [Andy McNally "creating resistance"](https://andymcnally.substack.com/p/creating-resistance); [The Coding Creative](https://thecodingcreative.substack.com/p/in-the-age-of-ai-artists-must-reclaim)
- Spawning runs its own Substack blog — [spawning.substack.com](https://spawning.substack.com/p/have-i-been-trained-is-back)

### Inferences
- Critic voices (Merchant, White, Zitron) and practitioner voices (Willison, Mollick) rarely address the *builder serving creatives* position directly; Nathan's angle — someone who uses AI, respects the objection, and builds disclosure tooling — bridges them.

### Gaps
- No audience numbers found for Mollick's One Useful Thing, Ted Gioia's The Honest Broker (which writes on AI slop in music), Zitron, Molly White's Citation Needed, or Willison's newsletter. Substack public subscriber badges could supply these.
