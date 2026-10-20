# Strongest Arguments Against a Consent-Based Critique of AI Training and Against AI Disclosure Mandates (as of Oct 20, 2026)

Research notes for steelmanning. Source-quality legend used below: **[verified]** = confirmed via search results this session; **[unverified]** = from secondary summaries or researcher background knowledge, not fetched this session (pluralistic.net, yalelawjournal.org, and medium.com were unreachable from the research environment). Exact quotes are only given where search results reproduced them; everything else is paraphrase.

## 1. "Learning is not copying" / fair use scholarship (EFF, Lemley & Casey, Samuelson, Sag, Sobel)

### Takeaway
The strongest legal-academic counter is that training is a "non-expressive" or "fair learning" use: models extract unprotectable facts, patterns and style, not protected expression, so requiring consent would expand copyright to cover things it has never covered (ideas, style, statistical information). The serious version concedes real limits (memorization and regurgitation, market substitution), and the main academic dissent (Sobel) agrees the problem is real but says fair use is the wrong frame either way.

### Cited Findings
- **Lemley & Casey, "Fair Learning."** Mark A. Lemley and Bryan Casey (Stanford Law). SSRN posting dated Jan 30, 2020; published in Texas Law Review vol. 99 (2021). It covers training for all kinds of ML models (self-driving cars, language), not only generative AI. It asks whether fair use doctrine, which has turned on "transformation", fits training on copyrighted datasets. **[verified for metadata]** — [SSRN abstract 3528447](https://papers.ssrn.com/abstract=3528447); [Texas Law Review PDF](https://texaslawreview.org/wp-content/uploads/2021/03/Lemley.Printer.pdf)
- Core thesis (paraphrase): copying done to *learn* unprotectable elements of works (facts, ideas, genre conventions, style) should generally be "fair learning". Copyright's legitimate concern starts when outputs take protected expression. They warn that a contrary rule would let copyright owners block socially valuable ML. **[unverified paraphrase; consistent with abstract]** — [Texas Law Review PDF](https://texaslawreview.org/wp-content/uploads/2021/03/Lemley.Printer.pdf); [Berkeley-hosted copy](https://www.law.berkeley.edu/wp-content/uploads/2024/04/Fair-learning.pdf)
- **Lemley's later work is more hedged.** He co-authored "Foundation Models and Fair Use" (Henderson, Li, Jurafsky, Hashimoto, Lemley, Liang; 2023, later in JMLR). It argues fair use is *not* guaranteed for generative models, especially where outputs resemble training data, and recommends technical mitigations such as output filtering and anti-memorization. Commentary notes that the later analysis is "more complicated for generative use cases". — [Stanford Law press: "AI Training Data Dilemma: Legal Experts Argue For 'Fair Use'"](https://law.stanford.edu/press/ai-training-data-dilemma-legal-experts-argue-for-fair-use); [Foundation Models and Fair Use text](https://object.cloud.sdsc.edu/v1/AUTH_da4962d3368042ac8337e2dfdd3e7bf3/ml-papers-txt/JMLR/2023/foundation_models_and_fair_use__2f0f73a8.txt)
- **Related SSRN paper "Fair Use and Machine Learning"** (abstract 3406283) is the other early scholarship in this line. — [SSRN 3406283](https://papers.ssrn.com/abstract=3406283)
- **EFF position (2023):** EFF's July 2023 two-pager argues that many criticized uses of works for training are already fair use even at scale. It says changing the law to make them infringing would hurt AI innovation *without benefiting artists*. EFF says artists' real protection should come from shielding them against companies that substitute AI for their labor (labor and anti-exploitation measures, not copyright). — [EFF AI two-pager, 2023-07-14](https://kittens.eff.org/files/2023/07/24/2023.07.14_ai_two_pager.pdf); [EFF comments to Copyright Office, Nov 2023](https://eff.org/files/2023/11/08/comments_of_eff_to_copyright_office_re_generative_ai.pdf)
- **EFF amicus in Kadrey v. Meta (Apr 2025):** EFF urged the court not to settle the fair-use question through the "side route" of how Meta acquired books (BitTorrent/piracy). It argued that whether training is lawful should not turn on acquisition method. — [EFF Deeplinks, Apr 2025](https://www.eff.org/deeplinks/2025/04/eff-urges-court-avoid-fair-use-shortcuts-kadrey-v-meta-platforms)
- **EFF incumbency argument:** a republished EFF post (summarized by an aggregator) cites Bartz to say courts treat training as transformative. It warns that mandatory text-and-data-mining licenses would favor large incumbents and hurt small and open-source developers. **[aggregator summary; original EFF post not fetched]** — [letsdatascience summary](https://www.letsdatascience.com/news/courts-uphold-fair-use-for-ai-training-7c63a411)
- **Matthew Sag (Emory):** "Copyright Safety for Generative AI" (Houston Law Review, 2023) and July 2023 Senate Judiciary testimony. Paraphrase: training is a "non-expressive use" in line with the Google Books and HathiTrust precedents. The genuine legal problem is *memorization/regurgitation*, which developers should engineer against ("copyright safety"), rather than training per se. **[unverified this session — background knowledge]**
- **Pamela Samuelson (Berkeley):** "Generative AI meets copyright", Science (July 2023), plus subsequent talks and amicus work. Paraphrase: courts have historically allowed intermediate copying for non-expressive purposes (reverse engineering, search engines, plagiarism detection). She notes that litigation threatens the field with potentially enormous statutory damages, and that the outcome is genuinely uncertain. She is a careful, not cheerleading, voice. **[unverified this session]**
- **Ben Sobel, the contrasting view:** "Artificial Intelligence's Fair Use Crisis", 41 Columbia Journal of Law & the Arts 45 (2017). Paraphrase: for *expressive* machine learning (models trained to produce works like the inputs), fair use faces a dilemma. If training is fair use, authors lose control and compensation to systems that may displace them. If it isn't, AI development is hamstrung and the result entrenches whoever can license. He questions whether the "non-expressive use" rationale fits generative models at all. This is useful because it takes the speaker's market-substitution intuition seriously while doubting that either copyright outcome fixes it. **[unverified this session]**

### Inferences
- The best steelman is not "AI learns just like a human." It is the narrower claim that copyright has never given authors control over *who learns from* their work, only over *reproduction of expression*. On this view, consent over learning is a new right, not the restoration of an old one.
- The fair-use camp's own concessions (memorization, output similarity, market substitution) are where the speaker's "competes with the source" point has the most purchase. That point is a market-harm (factor 4) argument, not a consent argument.

### Gaps
- Could not fetch Sag, Samuelson or Sobel texts this session. Their positions above are paraphrased from background knowledge and should be checked against the originals before quoting.
- Lemley's 2024–2026 writing (e.g., "How Generative AI Turns Copyright Upside Down") was not verified this session.

## 2. Cory Doctorow (and Rebecca Giblin): expanding copyright won't help artists

### Takeaway
Doctorow's argument: creators are already forced to assign their copyrights to concentrated intermediaries (labels, publishers, studios). A new "training right" would just be one more right that contracts make artists sign away, and the money would flow to those intermediaries. The fix he points to is labor power (sectoral bargaining, as in the 2023 WGA strike) and the non-copyrightability of AI output, not more copyright.

### Cited Findings
- **"Copyright won't solve creators' Generative AI problem"**, Pluralistic, Feb 9, 2023 (pluralistic.net/2023/02/09/ai-monkeys-paw). Secondary summaries describe it as arguing that stronger copyright is a weak tool for creators. The metaphor is that giving creators more copyright is like giving a bullied kid more lunch money. — [LinkedIn share of the post with title and date](https://www.linkedin.com/posts/robjdjones_pluralistic-copyright-wont-solve-creators-activity-7029931651040256000-DkbO); [VI-Control discussion thread](https://vi-control.net/community/threads/cory-doctorow-copyright-wont-solve-creators-generative-ai-problem.167169/); [Mastodon share](https://mastodon.social/@jbaert/109837082592060837)
- **Lunch-money metaphor source:** in his Locus column "The Swerve" (Nov 2022), Doctorow writes that if bullies steal a kid's lunch money every day, "it doesn't matter how much lunch money you give your kid, he's not gonna get lunch". Writers are the kid, the cartels controlling access to audiences are the bullies, and copyright is the lunch money. He says creators' share of income has fallen even as copyright expanded. **[quote as reproduced in search results]** — [Locus, "The Swerve," Nov 2022](https://locusmag.com/2022/11/commentary-by-cory-doctorow-the-swerve)
- **March 18, 2025 Pluralistic ("asbestos in the walls"):** per search summary, he argues that expanding copyright to ban scraping or training is a losing strategy. He says it would cause collateral damage to many socially useful activities (scraping for research, archiving, accessibility) and would not shield creators from AI-driven wage erosion. **[summary only; page unreachable]** — [Pluralistic, 2025-03-18](https://pluralistic.net/2025/03/18/asbestos-in-the-walls/)
- **Copyright as a sub-licensable property right:** he argues the "artist's-right" theory wrongly assumes exclusive rights give creators leverage. Because copyright can be assigned and sub-licensed, it gets transferred to whoever holds market power. — [Pluralistic post (summary)](https://pluralistic.net/?p=13191)
- **Sectoral bargaining:** he points to the WGA strike as the model, where all workers in a sector negotiate with every employer in that sector. He notes this has been largely illegal for most US workers since the Taft-Hartley Act (1947). — [Living Library repost of Doctorow essay](https://thelivinglib.org/?p=64282)
- **Non-copyrightability of AI output as leverage:** secondhand accounts say Doctorow argues the real bargaining chip is that purely AI-generated output can't be copyrighted (per US Copyright Office policy and *Thaler v. Perlmutter*), so firms need humans in the loop to own anything. **[secondhand forum account; treat cautiously]** — [Lemmy discussion](https://lemmy.klein.ruhr/post/192675/806073)
- **Right Click Save essay "AI 'Art' and Uncanniness" (Doctorow):** described as arguing that new labor law, not rewritten copyright, would protect creators. — [Right Click Save](https://www.rightclicksave.com/article/ai-art-and-uncanniness-cory-doctorow-artificial-intelligence-copyright)
- **Chokepoint Capitalism** (Rebecca Giblin & Cory Doctorow; Beacon Press, 2022; Scribe in UK/AU). Thesis: Big Tech and Big Content built chokepoints in book publishing, news, music, screenwriting and radio that capture value from creative labor. Remedies include transparency rights, collective action, cooperative ownership, and minimum-wage-style protections for creative work. The book predates the generative-AI boom and treats AI only in passing. — [Publishers Weekly listing](https://publishersweekly.com/9780807007068); [The New Stack review](https://thenewstack.io/online-community-fights-big-techs-chokepoint-capitalism/)
- **Yale Law Journal Forum, "ARTificial: Why Copyright Is Not the Right Policy Tool to Deal with Generative AI".** Per the search summary it applies the Chokepoint Capitalism arguments to AI and adds that copyright protects individual *works*, not *occupations*, so it can't address displacement. **[author/date not verified; page unreachable]** — [Yale LJ Forum](https://yalelawjournal.org/forum/artificial-why-copyright-is-not-the-right-policy-tool-to-deal-with-generative-ai)
- A Pluralistic post reportedly titled "IP can't save you from AI" (Aug 18, 2026) appears in an aggregator. Its content could not be verified. — [aiweekly aggregator](https://aiweekly.co/alerts/pluralistic-ip-cant-save-you-from-ai-18-aug-2026-pluralistic-daily-links-from)

### Inferences
- Doctorow does not deny the "ick" or the harm. He accepts the speaker's diagnosis (AI competes with and devalues artists) but rejects the remedy if it is property-based consent. For the speaker, the sharpest form of his challenge is: *who would actually hold the consent right?* In music, film and publishing it is often not the artist. Partial support comes from the fact that the Bartz settlement pays "copyright owners", which in many cases means publishers splitting with authors.
- His alternative lines up with the speaker's "influence follows reach" framing if that framing is recast as a *labor and market-power* problem rather than a consent problem.

### Gaps
- Exact quotes from the 2023 and 2025 Pluralistic posts could not be retrieved. Do not quote them without checking pluralistic.net directly.
- Could not verify the author or date of the Yale LJ Forum "ARTificial" piece, or the content of the Aug 2026 post.

## 3. Andy Baio (Waxy.org) and Creative Commons

### Takeaway
Baio is better used as an *empirical* source than as an anti-consent voice. His LAION analysis documented what was actually scraped, and he also coined the critical "AI data laundering" frame. Creative Commons offers a real middle position: copyright is a poor and overbroad tool for AI training (which may be fair use), so CC is building non-binding "preference signals" instead of licenses that forbid training.

### Cited Findings
- **Baio & Simon Willison, Aug 30–31, 2022:** they analyzed ~12M images from LAION-Aesthetics v2 6+ (about 2% of the 600M images used for later Stable Diffusion checkpoints, 0.5% of the 2.3B initial set). They built a Datasette browser, which was discontinued Dec 2023. Findings: nearly half the images came from ~100 domains, Pinterest was the largest source, and others included WordPress blogs, SmugMug, Blogspot, Flickr, DeviantArt, Wikimedia, 500px and Tumblr. They also counted the most-represented artists, celebrities and characters. — [Simon Willison, "Exploring the training data behind Stable Diffusion"](https://simonwillison.net/2022/Sep/5/laion-aesthetics-weeknotes); [Willison, Aug 31 2022](https://simonwillison.net/2022/Aug/31/laion-aesthetics); [80.lv summary](https://80.lv/articles/exploring-the-images-used-to-train-stable-diffusion-s-ai); [waxy.org](https://waxy.org/?p=44618)
- Baio's nuance (background, **[unverified this session]**):
  - In "AI Data Laundering" (Waxy, Sept 2022) he criticized how commercial firms use nonprofit or academic dataset creation (LAION, academic research exemptions) to launder data into commercial products. That is a *pro*-consent critique.
  - In "Invasive Diffusion" (Waxy, Nov 2022) he profiled illustrator Hollie Mengert, whose style was fine-tuned into a DreamBooth model without her consent. In the same piece he interviewed the model's creator, who argued that style isn't ownable.
  - So Baio presents both sides rather than taking the anti-consent position.
- **Creative Commons, preference signals:** since 2023, CC has explored preference signals as a way for creators to state wishes about AI use that are *not enforceable through the licenses*. Examples: "Don't train", "Train, but disclose that you trained on my content", "Train, only if using renewable energy sources". — [CC blog, Aug 31, 2023](https://creativecommons.org/2023/08/31/exploring-preference-signals-for-ai-training/); [CC blog, "Six insights on preference signals," Aug 23, 2024](https://creativecommons.org/2024/08/23/six-insights-on-preference-signals-for-ai-training/)
- **CC guidance (May 2025):** CC warns that choosing more restrictive CC licenses to block AI training may not work (since training may be fair use or TDM-excepted), and "may actually end up preventing the kind of sharing you want". — [CC, May 15, 2025](https://creativecommons.org/2025/05/15/understa)
- **CC signals launch (June 2025):** a proposed framework for "content stewards" to express how they want works used in AI training, with reciprocity-based norms and no legal effect. CC was still seeking input; no finalized spec or adoption status was found. — [CC signals coverage](https://gracker.ai/news/introducing-cc-signals-a-framework-for-open-ai-ecosystem); [NISO on CC preference signaling](https://niso.org/niso-io/2024/08/creative-commons-preference-signaling)
- CC's long-standing public stance (background, **[unverified this session]**): CC's 2023 comments to the US Copyright Office argued that training generative models on publicly available works should generally be fair use. CC also argued that copyright is a blunt instrument for issues like labor, privacy and bias.

### Inferences
- CC's position is a direct challenge to the speaker's framing *and* a partial ally of it. CC agrees creators deserve a voice ("preference signals" are a form of non-legal consent), but argues a binding consent regime would wreck the commons: Wikipedia, open-access research, and CC-licensed sharing.
- The speaker's "voluntary, specific disclosure" proposal closely parallels CC's voluntary-signals philosophy. That is a point of agreement to acknowledge.

### Gaps
- Could not confirm CC signals' adoption status as of Oct 2026, or whether any major AI developer committed to honoring it.

## 4. Court outcomes and official reports (2025–2026)

### Takeaway
As of Oct 2026, the US case law is split.
- Two N.D. Cal. judges held that training *itself* can be fair use, but piracy-based acquisition was the weak point. Bartz led to a record $1.5B settlement, finally approved July 2026.
- The only appellate ruling (3d Cir., *Ross*, Sept 2026) rejected fair use, but for a *non-generative* competing product.
- The UK Getty ruling found model weights don't store copies.
- NYT v. OpenAI is at summary judgment.
- The Copyright Office's May 2025 report leans against fair use for commercial, competing uses.

### Cited Findings
**Bartz v. Anthropic (N.D. Cal.)**
- June 23, 2025, Judge William Alsup. He held that training Claude on lawfully acquired books was fair use, describing it as highly transformative and analogizing it to a reader learning to write. Buying print books and scanning them was also fair use. Downloading and keeping a central library of pirated books (LibGen, PiLiMi) was *not* fair use and went to class trial. Alsup did not reach Kadrey's "market dilution" theory. **[holding details from background knowledge plus secondary sources]** — [Authors Alliance comparison](https://www.authorsalliance.org/2025/06/26/meta-wins-on-fair-use-for-now-but-court-leaves-door-open-for-market-dilution/)
- **Settlement:** $1.5B plus interest to owners of works taken from LibGen/PiLiMi, and Anthropic must destroy those files and derived copies. Background, not verified this session: about $3,000 per work across ~480–500k works, announced Sept 2025.
  - Final approval came **July 20, 2026** from Judge Araceli Martínez-Olguín; the case was reassigned after Alsup.
  - All 53 objections were overruled. About 91.3% of works were claimed as of Apr 16, 2026.
  - Fees were cut to $101.56M (~6.8%) from the 12.5% requested, and class representatives got $15,000 each.
  - A 30-day appeal window ran from July 20. No payout date was announced at the time of reporting.
  — [Authors Guild](https://authorsguild.org/news/court-grants-final-approval-anthropic-copyright-settlement/); [JURIST, July 2026](https://www.jurist.org/news/2026/07/judge-approves-record-1-5-billion-settlement-involving-anthropic/); [AAP](https://publishers.org/news/aap-welcomes-courts-final-settlement-approval-in-bartz-v-anthropic/); [Pearl Cohen](https://pearlcohen.com/federal-court-approves-1-5-billion-anthropic-copyright-settlement-largest-in-history)
- Counter-reading for the speaker: the settlement compensates the *piracy*, not the training, which the court held to be fair use. Payment flows to "copyright owners", including publishers.

**Kadrey v. Meta (N.D. Cal.)**
- June 25, 2025, Judge Vince Chhabria granted Meta summary judgment on the training claims. The plaintiffs failed to build a record of market harm, especially "market dilution" (AI output flooding the market for works like theirs).
- He stressed that the ruling does *not* hold Meta's training lawful, only that "these plaintiffs made the wrong arguments".
- In dicta he suggested that in many cases training on copyrighted works without permission would likely be illegal because of market dilution. This is the strongest judicial support for the speaker's "competes with the source" point.
- A distribution (torrent seeding) claim survived.
— [Authors Alliance, June 26, 2025](https://www.authorsalliance.org/2025/06/26/meta-wins-on-fair-use-for-now-but-court-leaves-door-open-for-market-dilution/); [FisherBroyles analysis](https://fisherbroyles.com/news/client-alert-summary-and-strategic-analysis-of-judge-chhabrias-fair-use-ruling-in-kadrey-v-meta); [ChatGPT Is Eating the World](https://chatgptiseatingtheworld.com/2025/06/25/meta-prevails-on-fair-use-in-ai-training-in-kadrey-v-meta-but-judge-chhabria-cautions-a-better-record-of-dilution-or-market-harm-could-prevail-in-other-cases/)

**Thomson Reuters v. Ross Intelligence**
- Feb 11, 2025: Judge Stephanos Bibas (D. Del., sitting by designation) granted partial summary judgment to Thomson Reuters on 2,243 Westlaw headnotes and rejected fair use.
- The Third Circuit heard interlocutory appeal argument on June 11, 2026 (Judges Restrepo, Montgomery-Reeves, Bove) and **affirmed on Sept 29, 2026**. It held the headnotes copyrightable and the use not fair, because Ross used them commercially to build a competing legal-research product. The opinion was unsealed in Oct 2026.
- Commentators call it the first federal appellate decision on fair use in AI training. They also stress that ROSS was *not generative AI* and that the copying predated generative AI, which limits its reach.
- Sources disagree on the opinion's author; Haynes Boone says Montgomery-Reeves.
— [LawNext, Sept 2026](https://www.lawnext.com/2026/09/3rd-circuit-rules-for-thomson-reuters-in-its-copyright-fight-against-legal-research-startup-ross.html); [LawNext, Oct 2026 (unsealed opinion)](https://www.lawnext.com/2026/10/no-more-than-an-ordinary-copyright-case-3rd-circuit-unseals-its-opinion-in-thomson-reuters-case-against-ross.html); [Haynes Boone](https://www.haynesboone.com/news/alerts/third-circuit-rejects-fair-use-for-rosss-copying-of-westlaw-headnotes); [ChatGPT Is Eating the World, Apr 2026](https://chatgptiseatingtheworld.com/2026/04/14/third-circuit-sets-oral-argument-on-june-11-for-1st-appeal-of-decision-on-fair-use-in-ai-training-case-follows-another-recent-third-circuit-decision-on-fair-use-in-american-society-for-testing-v-upc/)

**Getty Images v. Stability AI (UK High Court, [2025] EWHC 2863 (Ch), Nov 4, 2025)**
- Getty dropped its primary training and output copyright claims during trial. Per background knowledge, this was largely because training occurred outside the UK, so the claims raised jurisdiction problems.
- On secondary infringement, the court held that an AI model can be an "article", but Stable Diffusion's weights do not store or contain copies of Getty's works, so the model is not an "infringing copy".
- Trademark claims succeeded only in "extremely limited" form, for early model versions (watermark reproduction).
- Leave to appeal on secondary infringement was granted Dec 17, 2025; current appeal status unknown.
- Commentators note UK courts still haven't decided the training question itself.
— [AIPPI](https://www.aippi.org/news/getty-images-v-stability-ai-uk-high-court-finds-no-secondary-copyright-infringement-in-landmark-genai-ruling/); [Bird & Bird](https://cm.twobirds.com/en/insights/2025/uk/stability-ai-defeats-getty-images-copyright-claims-in-first-of-its-kind-dispute-before-the-high-cour); [CMS case tracker](https://cms.law/en/nld/publication/artificial-intelligence-and-copyright-case-tracker/united-kingdom-getty-images-us-inc-ors-v-stability-ai-ltd2)
- Relevance to the speaker: this is the strongest judicial support for "the model learned, it didn't copy" at the level of what the artifact contains.

**NYT v. OpenAI & Microsoft (S.D.N.Y., part of OpenAI MDL 25-md-03143)**
- The core infringement claims survived dismissal.
- On Jan 5, 2026, Judge Stein affirmed an order compelling production of 20M de-identified ChatGPT logs.
- Cross-motions for summary judgment were filed Sept 4, 2026. Sources disagree on whether reply briefing ends Nov 6 or Nov 20, 2026.
- On Sept 1, 2026, the **US Justice Department filed a statement supporting fair use for AI training**, which publishers asked the court to disregard.
- No trial date and no fair-use ruling yet. Treat the docket-based trackers as more reliable than SEO "2026 ruling" pages, which conflict.
— [AI Lawsuit Tracker](https://ailawsuittracker.com/cases/new-york-times-v-openai/); [Legal AI Insights](https://legalaiinsights.com/risk-digest/nytimes-openai-lawsuit-status)

**US Copyright Office, Part 3: Generative AI Training (pre-publication version, May 9, 2025)**
- Non-binding. It concludes some uses (e.g., research and analysis) may be fair. Commercial uses that produce expressive content competing with the originals, especially via illegal access, likely exceed fair use.
- It recommends against immediate government intervention and favors letting voluntary licensing markets develop, possibly with extended collective licensing.
- Background, **[unverified]**: the report also rejected the "AI learns like a human" analogy and gave credence to the market-dilution theory.
- Register Shira Perlmutter was fired the next day, May 10, 2025. Litigation over her removal followed; status not verified.
— [Patently-O](https://patentlyo.com/patent/2025/05/transformative-copyright-leadership.html); [Mass Law Blog](https://masslawblog.com/general/copyright-office-issues-long-awaited-report-on-generative-ai-training-register-of-copyrights-is-fired-next-day/); [Publishers Weekly](https://www.publishersweekly.com/pw/print/20250519/97748-copyright-chief-fired-amid-ai-debate.html)

### Inferences
- Opponents of the consent critique can point to: two district courts calling training transformative, a UK court finding that weights hold no copies, the DOJ backing fair use (Sept 2026), and the Copyright Office's preference for voluntary licensing over mandates.
- Proponents can point to: *Ross* (appellate, but non-generative), Chhabria's dilution dicta, the Copyright Office report, and a $1.5B payout. Honest framing: **the law is unsettled, and the strongest pro-AI wins are about *training*, while the losses are about *piracy* and *direct competitors*.**
- Even the pro-AI rulings support the speaker's "competes with the source" factor more than his "consent" factor. Courts frame harm as market substitution, not lack of permission.

### Gaps
- No appellate ruling yet on *generative* AI training fair use in the US. Status of the Bartz settlement appeals after Aug 2026 not found.
- Getty UK appeal status after Dec 2025 not found.
- Status of the Perlmutter removal litigation and whether a final (non-pre-publication) Part 3 was issued: not verified.

## 5. Consent/opt-in regimes entrench incumbents, harm open research, are unworkable; influence was never consensual

### Takeaway
The strongest structural argument: a consent or licensing requirement turns training data into a priced input that only the biggest firms can afford. Evidence: the $1.5B Bartz settlement and the licensing deals. Such a regime would lock out open-source and academic models while paying mostly intermediaries. The cultural argument: artistic influence was *never* consensual, and the law deliberately leaves style, ideas and genre free.

### Cited Findings
- EFF: licensing requirements for text-and-data mining would favor large incumbents and harm small and open-source developers; changing the law would hurt innovation without benefiting artists. — [EFF two-pager, 2023](https://kittens.eff.org/files/2023/07/24/2023.07.14_ai_two_pager.pdf); [aggregator summary of later EFF post](https://www.letsdatascience.com/news/courts-uphold-fair-use-for-ai-training-7c63a411)
- Doctorow: banning scraping would cause collateral damage to socially useful activities. — [Pluralistic, 2025-03-18](https://pluralistic.net/2025/03/18/asbestos-in-the-walls/)
- Creative Commons: restrictive licenses can block beneficial sharing (e.g., translation) while failing to block training. — [CC, May 2025](https://creativecommons.org/2025/05/15/understa)
- Sobel's dilemma: denying fair use for expressive ML could restrict AI development to those able to license at scale. **[unverified this session]**
- Scale of costs: Anthropic's $1.5B settlement for ~500k pirated books. **[per-work figure from background]** It shows what compensation at scale looks like, and implicitly what a new entrant could not pay. — [JURIST](https://www.jurist.org/news/2026/07/judge-approves-record-1-5-billion-settlement-involving-anthropic/)
- The Copyright Office itself recommended voluntary and collective licensing over mandates. — [Mass Law Blog](https://masslawblog.com/general/copyright-office-issues-long-awaited-report-on-generative-ai-training-register-of-copyrights-is-fired-next-day/)
- Unworkability (background, **[unverified]**): LAION-scale datasets contain billions of items from ~5B scraped image-text pairs (per Baio/Willison's description of the LAION pipeline), where per-item consent or provenance is impractical. — [Simon Willison](https://simonwillison.net/2022/Sep/5/laion-aesthetics-weeknotes)
- "Influence was never consensual" / style is not protectable (background, **[unverified]**): US copyright protects expression, not ideas or style (17 U.S.C. §102(b)). Lemley & Casey's "fair learning" rests on that line. The model creator profiled in Baio's "Invasive Diffusion" made this argument directly.

### Inferences
- Steelman: "Artists accepted being copied as the price of being heard" assumes there was a contract. Critics would say there was never a contract, only a legal default that ideas and style are free. Under that default, every artist took from others without consent or credit (pastiche, genre, schools). If the "contract" was really reciprocity of *reach*, the remedy is about attribution and market power, not permission.
- The incumbency argument cuts hardest against the speaker if consent becomes legal (licensing), and least if it stays normative (voluntary signals, which he favors).

### Gaps
- No quantitative study found this session on licensing costs for small or open developers, or on open-source model availability under opt-in regimes.
- EU AI Act / TDM opt-out experience (Article 4 DSM Directive) not researched here.

## 6. Arguments against mandatory AI labeling and disclosure

### Takeaway
The strongest empirical case:
- AI labels lower trust in content *regardless of whether it is true or human-made*, because people read "AI-generated" as "unsupervised and suspect".
- "AI" is hard to define (process-based vs. harm-based labels).
- Labels can stigmatize users who rely on AI as an assistive tool.

Researchers (Gilardi, Rand group) argue labels should flag *misleading* content, not AI *process*.

### Cited Findings
- **Altay & Gilardi (PNAS Nexus, 2024):** preregistered experiments, N = 4,976 (US/UK).
  - Labeling headlines "AI-generated" lowered perceived accuracy and sharing intent *regardless of whether headlines were true or false, or human- or AI-written*.
  - The effect was 2.66 percentage points, about 3x smaller than a "false" label (9.33pp).
  - The mechanism: people assume "AI-generated" means fully AI-written without human oversight.
  - The authors warn of "undue skepticism" in high-quality information environments.
  - Gilardi: it makes more sense to distinguish problematic from unproblematic content than AI from non-AI.
  — [PNAS Nexus pgae403](https://academic.oup.com/pnasnexus/article/3/10/pgae403/7795946); [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC11443540); [blue News (Keystone-SDA quote)](https://www.bluewin.ch/en/news/people-distrust-ai-generated-headlines-2393402.html)
- **Wittenberg, Epstein, Péloquin-Skulski, Berinsky & Rand, "Labeling AI-generated media online" (PNAS Nexus, 2025):** contrasts *process-based* labels (how content was made) with *harm-based* labels (potential to mislead), and argues platforms must choose which goal labels serve. — [SSRC MediaWell listing](https://mediawell.ssrc.org/?p=513439)
- **Epstein et al., "What label should be applied to content produced by generative AI?" (2023):** background, **[unverified]**: Epstein, Fang, Arechar & Rand, surveying multiple countries. Terms like "AI-generated" are understood as describing *process*, terms like "manipulated" or "deepfake" as describing *deception*, and no single term covers both. A Rand-coauthored study reported that no single term captures the full range of AI-assisted content and that interpretation varies by culture. — [All About Content (Dec 2023)](https://allaboutcontent.substack.com/p/are-content-labels-the-answer-to); [ExpertBeacon summary](https://expertbeacon.com/how-to-label-and-disclose-your-ai-content-guidelines-and-examples-for-seo/)
- **Implied truth effect** (Pennycook, Bear, Collins & Rand, Management Science, 2020): when only some false items get warnings, *unlabeled* false items are seen as more accurate. By analogy, partial AI labeling makes unlabeled AI content look "verified human". **[unverified this session — background]**
- **Label inflation / definition problem** (background, **[unverified]**):
  - Meta's 2024 "Made with AI" label was applied to real photos edited with minor generative tools (e.g., Photoshop), which drew photographer backlash. Meta renamed it "AI info" in July 2024.
  - This shows the difficulty of defining "AI-assisted".
- **Disclosure stigma:**
  - A literature review finds writers withhold disclosure because they anticipate stigma, lower perceived quality, and reduced sincerity. — [Moonlight review of "What Shapes Writers' Decisions to Disclose AI Use?"](https://www.themoonlight.io/review/what-shapes-writers-decisions-to-disclose-ai-use)
  - Background, **[unverified]**: Reif, Larrick & Soll (PNAS, 2025) found a "social evaluation penalty", where people who use AI at work are judged lazier and less competent.
- **Accessibility and non-native speakers:**
  - Liang, Zou et al. (Patterns, 2023) found GPT detectors misclassify non-native English writing as AI-generated and conclude detectors "discriminate against non-native authors". So enforcement-by-detection of disclosure rules falls hardest on them. — [Times Higher Education](https://timeshighereducation.com/cn/news/ai-text-detectors-biased-against-non-native-english-speakers); [AOL/Fortune coverage](https://www.aol.com/ai-hidden-bias-against-non-200700155.html)
  - A HICSS 2025 paper found generative AI provides real writing benefits for disabled students (planning, articulating ideas), alongside voice and integrity concerns. — [ScholarSpace, HICSS](https://scholarspace.manoa.hawaii.edu/items/24ab25d3-649d-41ed-b08f-c842cf3d4dab/full)
  - Background, **[unverified]**: in Sept 2024 NaNoWriMo stated that categorically condemning AI is "classist and ableist". This is the most prominent public accessibility argument, and it drew heavy backlash, including from disabled writers, plus sponsor departures. NaNoWriMo later shut down (2025). It is useful as both the argument and the cautionary tale.

### Inferences
- The best anti-mandate argument isn't "disclosure is bad". It is that *generic process labels misinform*: they push trust down for true content, create a false "human = verified" halo for unlabeled content, and penalize people for whom AI is assistive.
- This partly *supports* the speaker. His "voluntary, specific" disclosure (what AI did) answers the "AI-generated = fully automated" misreading Altay & Gilardi identified. But critics would say even voluntary norms become de facto mandates through social pressure, and specificity is costly and hard to verify.

### Gaps
- Found no study directly measuring a disclosure penalty for disabled or dyslexic writers specifically. The accessibility argument rests on adjacent evidence (detector bias, assistive-benefit studies) and advocacy statements.
- Did not verify the Pennycook implied-truth paper, Reif et al. 2025, or Meta labeling events this session.

## 7. Pro-AI artists and musicians on consent

### Takeaway
The most prominent pro-AI artists mostly *accept consent as a value* but implement it through artist-controlled tools and licensing (Holly+ DAO, Spawning opt-outs, Grimes' 50% royalty split), not through copyright expansion or rejection of AI. That gives the speaker opponents who agree on consent but disagree on the "ick".

### Cited Findings
- **Holly Herndon:**
  - Trained her earlier model Spawn on data she owned or had permission to use (album *PROTO*, 2019).
  - Launched Holly+ (2021, with Never Before Heard Sounds), a voice model of her own voice open for public use, governed by a DAO that votes on approved uses and shares profits.
  - Co-founded Spawning to help artists consent to (or refuse) use as training data. Background, **[unverified]**: Spawning's "Have I Been Trained?" (2022) and Do Not Train registry, which Stability AI and Hugging Face said they would honor.
  — [Rolling Stone](https://www.rollingstone.com/music/music-news/holly-herndon-ai-deepfake-tool-1197200/); [NOISE DAO, "Consensual data in the age…"](https://noisedao.substack.com/p/issue-10-consensual-data-in-the-age); [New Suns](https://newsuns.net/holly-herndon-spawning-identities/)
- **Grimes:** in April 2023 she offered 50% of royalties on any successful AI song using her voice. In 2023 she launched Elf.Tech, which lets users transform vocals into her voice and release commercially for a 50% master-royalty split (reports phrase the split slightly differently). — [TechCrunch, Apr 26, 2023](https://techcrunch.com/2023/04/26/grimes-ai-generated-drake-music-legal-issues); [Hot Press](https://hotpress.com/music/canadian-singer-and-producer-grimes-has-unveiled-new-ai-software-to-mimic-her-voice-22966181)
- The TechCrunch critique of these models: most artists don't know their voice *can* be modeled until it is too late. This cuts in favor of the speaker. — [TechCrunch](https://techcrunch.com/2023/04/26/grimes-ai-generated-drake-music-legal-issues)
- Overview of musician-led AI initiatives. — [Six Peas, "Musician-led AI initiatives"](https://sixpeas.substack.com/p/musician-led-ai-initiatives)

### Inferences
- Herndon's position is arguably the speaker's best "smart disagreement". She agrees consent matters, but treats AI as a new medium to *shape* (protocols, consent tooling, shared ownership) rather than an "ick" to resist. She also frames voice and likeness as something to open up on one's own terms.
- Grimes models "permissionless with revenue share", a market answer to the "no credit, no audience" complaint.

### Gaps
- No 2025–2026 statements from Herndon, Grimes, or other pro-AI visual artists were retrieved this session. Other figures (e.g., Refik Anadol, Sougwen Chung) were not researched.

## 8. Economists/technologists: displacement fears overstated; AI expands participation

### Takeaway
The best quantitative evidence for "AI expands creative participation" is Zhou & Lee (2024):
- on a large art platform, AI adopters produced 25% more output and got more peer favorites;
- adoption *reduced* concentration of rewards among adopters;
- average novelty fell.
Evidence is observational and contested by labor-market studies.

### Cited Findings
- **Eric Zhou & Dokyun Lee, "Generative artificial intelligence, human creativity, and art," PNAS Nexus 3(3):pgae052, March 2024:**
  - Data: 4M+ artworks from 50k+ users.
  - Text-to-image adoption was associated with about 25% higher creative productivity and a 50% higher likelihood of a favorite per view over time.
  - Peak novelty rose, while average content novelty and visual novelty fell.
  - Gains went to artists skilled at ideation and filtering ("generative synesthesia").
  - Adoption decreased concentration of favorites among adopters.
  - The data is observational and from one platform.
  — [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC10914360); [BU Questrom](https://www.bu.edu/questrom/blog/eric-zhou-dokyun-lee-generative-artificial-intelligence-human-creativity-and-art); [BU Digital Business Institute](https://www.bu.edu/dbi/2024/03/04/generative-ai-human-creativity-and-art)
- **Counter-evidence (background, [unverified]):** Hui, Reshef & Zhou (2023/2024, Organization Science) found that freelancers on an online labor platform saw fewer jobs and lower earnings in writing and image-related categories after ChatGPT and image generators launched. This supports the speaker's displacement concern.

### Inferences
- The "expands participation" argument is strongest about *who gets to make things* (lower barriers, less concentration). It is weakest about *incomes of existing professionals*, where early labor-market evidence points the other way.

### Gaps
- Did not retrieve 2025–2026 economic studies on creative-labor displacement, or technologist essays arguing displacement is overstated (e.g., from a16z or Ethan Mollick). These need a separate search.
