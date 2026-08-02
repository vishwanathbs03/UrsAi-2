# UrsBiz Sprint H4.2-P1 — AI Assistant Personalization & Intent Quality

**Date:** 2026-08-02
**Source-of-truth:** `D:\MSME\UrsAi\SPRINT_H4_1_QUALITY_REPORT.md`
**Prior milestone:** `D:\MSME\UrsAi\SPRINT_H4_2_P0_REPORT.md` (preserved — no regression)
**Ad-hoc verifier:** `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1.js`
**Verifier stdout:** `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1-stdout.txt` (134 lines, 8,444 bytes)
**Verifier result:** PASS — 44 PASS, 0 FAIL, exit code 0
**Bundle built at:** `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1-build\`
**Canonical gates:** type-check exit 0, lint exit 0, build exit 0 (20/20 routes prerendered)

## Scope

|| Allowed | Forbidden |
||---------|-----------|
|| Implement the six P1 issues from the H4.1 evaluation | Add new modules |
|| Extend `assistant-p0.ts` (created in P0) with P1 helpers | Replace the entire assistant architecture |
|| Wire existing P0 helper exports into `consultant.ts` | Modify authentication |
|| Add only `growth_target` + `product_help` classifier entries + keyword expansions | Modify database schema |
|| Ad-hoc verifier under `%TEMP%` with `hermes-verify-` prefix | Modify unrelated backend APIs |
||| Redesign the whole assistant UI |

**No new files** were added to the repo by this sprint (only extensions to the four files already present at the end of H4.2-P0). No new npm packages. No backend / API / DB / auth / routing / schema edits.

---

## Six P1 issues — issue · root cause · fix · before · after · files

### P1.1 — Industry-aware advice

**Issue.** Six questions that mentioned industry-specific context (Q12 "I want to open a second unit in Tirupur next year" / Q13 "fabrics + IEC number" / Q18b "B2B retail audience") produced answers with no industry vocabulary. The H4.1 report flagged this in §3 weakness #4: "No answers adapt to industry context."

**Root cause.** `consultant.ts` had a single generic greeting ("Growth strategy for **Acme Textiles**") and a single generic recommendation list ("Run paid social on one channel first"). No industry-adaptation layer existed. `classify-query.ts` ignored industry terms entirely (no "tirupur" / "fabric" / "manufacturing" mapping).

**Fix.**
- Extended `assistant-p0.ts` with a small **industry-adaptation table** (`INDUSTRY_ADAPTATIONS[]`) covering Textiles & Apparel, Retail / D2C, Manufacturing, Technology / Services, plus a generic MSME fallback. Each row carries vocabulary (certifications, channels, compliance, suppliers, buyers) and a 5-step playbook.
- Added `matchIndustry(industry)` — substring matcher that returns the adapted row, falling back to `GENERIC_ADAPTATION` when no row matches.
- Added `industryGreetingLine(adapt, kindLabel, legalName)` — produces an industry-adapted summary opener that replaces "Growth strategy for X" with "Growth playbook for **X** (Textiles & Apparel). We anchor growth on certifications + the dominant discovery channel first."
- Added `industryPlaybookBullets(adapt, kind)` — returns 3-5 industry-specific bullets shaped by kind (growth / export / marketing / scaling / improve).
- Wired `matchIndustry(...) + industryGreetingLine(...) + industryPlaybookBullets(...)` into `improveSummary` / `growthSummary` / `composeGrowth` / `exportSummary` / `composeExport` / `scalingSummary` / `composeScaling`.

**Before (Q12 — Tirupur, textiles).**
> "Scaling strategy for **Acme Textiles**. Three vectors: (1) new geographies, (2) new channels, (3) new SKUs. Pick the one your engine scores highest on — usually it's exports if your readiness > 50."
>
> Findings: "Export readiness: 60/100, Digital readiness: 35/100, Scaling fit." Recommendations: "Pilot a new geography (30 days), Launch a second sales channel, Add a flagship SKU."

**After (P1.1 wired).**
> "Scaling roadmap for **Acme Textiles** (Textiles & Apparel). The qualified-buyer pool (Buying houses / Apparel brands (Zara, H&M, M&S)) shapes the channel choice. Three vectors: (1) new geographies, (2) new channels, (3) new SKUs."
>
> Findings now include: **"Industry cluster: Textiles & Apparel — Buyer pool for new geography = Buying houses / Apparel brands (Zara, H&M, M&S)."**
> Recommendations now append industry-specific bullets like: **"Certification anchor: OEKO-TEX (often a buyer gate in this industry). Discovery channel: India Mart. Audit your top-3 supplier dependencies and qualify a second source for each."**

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — added `IndustryAdaptation` interface + `INDUSTRY_ADAPTATIONS[]` + `GENERIC_ADAPTATION` + `matchIndustry()` + `industryGreetingLine()` + `industryPlaybookBullets()` (5 new exports).
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — extended `improveSummary`, `growthSummary`, `composeGrowth`, `exportSummary`, `composeExport`, `scalingSummary`, `composeScaling` to call the above.

---

### P1.2 — Fix Action Plan week labels ("Week undefined")

**Issue.** "Week undefined" / "Week null" / empty labels rendered for every action-plan week. The H4.1 report flagged this in §3 weakness #5.

**Root cause.** `consultant.ts`'s `actionWeeksFromRecommendation` only set the legacy `week` (string) + `steps` (string[]) fields. The new `ActionWeek` shape (in `types.ts`) requires a quartet: `weekNumber` (number), `weekLabel` (string), `objective` (string), `actions` (string[]). None of them were populated, so the renderer fell back to `Week ${i+1}` or "Week undefined". `tsc --noEmit` flagged 16 of these missing-field errors at H4.2-P1 hand-off.

**Fix.**
- Added `RawActionWeek` / `NormalizedActionWeek` interfaces + `defaultPhaseFor(i)` in `assistant-p0.ts`.
- Added `normalizeActionWeek(input)` — guarantees every emitted `ActionWeek` has all four new fields populated; pulls the phase from a 21-entry `PHASE_OBJECTIVES` lookup (Discover, Build, Activate, Optimise, Pre-qualification, Compliance, First shipment, Scale, File readiness, File paperwork, Approval / acknowledgement, Risk review, Set up, Kickoff, Iterate, Handover, Baseline + Gap, Lever 1, Lever 2, Lever 3) and falls back to the first `steps[0]` truncated to 80 chars.
- Added `normalizeActionWeeks(weeks, defaultPhase?)` — runs `normalizeActionWeek` over the whole list, replaces any `undefined` / `null` / empty / "Week N" (no phase) labels with the canonical `Week N — Phase` format. Never produces a label === "undefined".
- Refactored `consultant.ts:actionWeeksFromRecommendation` to type intermediate `raw` as `LegacyWeek[]` (old shape only), then pipe the final return through `normalizeActionWeeks(raw)`. TypeScript no longer requires the new fields inline.
- Also wrapped the growth-target weeks (`growthTargetWeeks`) through `normalizeActionWeeks(...)` before pushing into the action-plan section.

**Before.** "Week undefined (): Audit current digital footprint …" — every week had `weekNumber=undefined`, `weekLabel=undefined`, `objective=undefined`, `actions=undefined`.

**After.** Every week now carries:
> `weekNumber=1 (number)` | `weekLabel="Week 1 — Baseline + Gap"` | `objective="Quantify the  2× current revenue gap and source-of-truth numbers."` | `actions=3`
> `weekNumber=2 (number)` | `weekLabel="Week 2 — Lever 1 (existing customers)"` | `objective="Stand up the lowest-CAC lever first."` | `actions=3`
> `weekNumber=3 (number)` | `weekLabel="Week 3 — Lever 2 (channel or product)"` | `objective="Add a second lever after the first shows signal."` | `actions=3`
> `weekNumber=4 (number)` | `weekLabel="Week 4 — Lever 3 (de-risk + reassess)"` | `objective="Confirm whether the next year path is realistic; revise."` | `actions=3`

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — added 3 new exports: `normalizeActionWeek`, `normalizeActionWeeks`, `defaultPhaseFor`.
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — refactored `actionWeeksFromRecommendation` (now ~250 lines total) to call `normalizeActionWeeks(raw)` on the way out.

---

### P1.3 — Target-based growth questions (₹1.5 Cr → ₹3 Cr)

**Issue.** Q2 "My revenue is ₹1.5 Cr. What can I do to reach ₹3 Cr next year?" routed to `fallback` → generic overview. The user got a portfolio recap, no numeric plan, no growth-lever decomposition. H4.1 §3 weakness #7.

**Root cause.** No `growth_target` `QueryKind` existed; `extractGrowthTarget` was defined in `assistant-p0.ts` but never wired. Even when the rescue classifier matched `growth_strategy`, the composer only produced generic recs + 4-week plan, never a "Current vs Target vs Gap" decomposition.

**Fix.**
- Added two new exports to `assistant-p0.ts`:
  - `extractGrowthTarget(prompt)` — parses Indian rupee amounts (`1.5 Cr` / `15 lakh` / `₹` / `1,50,00,000`), detects horizon phrases ("next year", "by Q4", "in 12 months"), and returns `{ currentInr, targetInr, gapInr, multiplier, horizon, rawPrompt, present }`.
  - `formatInr(n)` — formats INR as `₹1.5 Cr` / `₹15 L` / `₹1,234`.
  - `GROWTH_LEVERS[]` — 5 standard levers (existing customer revenue → new products → new channels → new markets → digital acquisition).
  - `growthTargetBody(target, adapt)` — produces the scenario-language summary ("To target", "Potential path", "Assuming").
  - `growthTargetWeeks(current, target, horizon, adapt)` — 4-week phased plan (Baseline + Gap → Lever 1 → Lever 2 → Lever 3 + de-risk).
- Added a new `growth_target` entry to `ROUTES` in `consultant.ts` (with `growthTargetSummary` + `composeGrowthTarget`).
- Added a pre-routing hook in `buildConsultantResponse` that runs `extractGrowthTarget(prompt)` and re-routes to `growth_target` when the prompt is goal-shaped (`(from X to Y)` / `(reach|target|grow to|hit|achieve) ... ₹`) and currently routed to fallback / improve_business / growth_strategy / what_first.
- Added a `growth_target` rule to `classify-query.ts` for the keyword path (`from ₹` / `to ₹` / `reach ₹` / `grow to ₹` / `grow from` / etc.).
- Added `growth_target` to `NEXT_QUESTIONS`.

**Before (Q2).**
> "I read your question ... against every payload the platform tracks. The closest intent I found matches the general overview."
> 5 recs, generic 4-week plan. No ₹1.5 Cr / ₹3 Cr cited. No lever ordering. No scenario language.

**After (P1.3 wired).**
> **Current** — ₹1.5 Cr
> **Target** — ₹3 Cr within next year
> **Gap** — ₹1.5 Cr (2× current)
> **Potential path** — four levers ranked by ease (existing customers → new products → new channels → new markets).
> **Assuming** current product mix + pricing, the first lever alone typically closes 25-40% of the gap...
> **Risks** — large gaps assume either price uplift (often unrealistic) or significant new-customer acquisition...
>
> 4-week action plan:
> - Week 1 — Baseline + Gap (Quantify the 2× current revenue gap and source-of-truth numbers.)
> - Week 2 — Lever 1 (existing customers) (Stand up the lowest-CAC lever first.)
> - Week 3 — Lever 2 (channel or product) (Add a second lever after the first shows signal.)
> - Week 4 — Lever 3 (de-risk + reassess) (Confirm whether the next year path is realistic; revise.)
>
> Recommendations: 5 growth levers (Increase existing customer revenue / Add new products or services / Enter new channels / Enter new markets / Improve digital acquisition).

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — 5 new exports.
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — added `growth_target` route entry + `growthTargetSummary` + `composeGrowthTarget` + the re-route hook + `NEXT_QUESTIONS.growth_target`.
- `D:\MSME\UrsAi\frontend\features\assistant\classify-query.ts` — added `growth_target` keyword bucket.

---

### P1.4 — User-stated risk priority ("My biggest worry is supplier dependency")

**Issue.** Q11 "My biggest worry is a single yarn supplier going out of business" routed to `fallback`. The user's exact concern was sitting in `risk_matrix.critical_risks[0]`, but the orchestrator answered with a generic overview. H4.1 §3 weakness #8.

**Root cause.** No extraction of user-stated concerns. The risk composer (`composeRisk`) listed `critical_risks` + `high_risks` + `medium_risks` sorted by priority — but it gave no special treatment to whatever the user explicitly typed. The concern phrase ("my biggest worry is X") went unrecognised.

**Fix.**
- Added two new exports to `assistant-p0.ts`:
  - `extractUserConcern(prompt)` — recognises 11 concern phrases ("my biggest worry", "my concern is", "i'm worried about", "what worries me", "scared of", etc.) and returns `{ present, topic, keywords }` with the topic phrase + lowercased keyword tokens.
  - `userConcernLeadBullet(concern, criticalRisks)` — returns a `{title:"You said it first: X", subtitle:"Matches critical risk in your register — Y", tone:"danger"}` lead bullet that matches the concern to a critical risk by keyword overlap, or falls back to a generic acknowledgement.
- Added a pre-routing hook in `buildConsultantResponse` that runs `extractUserConcern(prompt)` and re-routes to `risk` when the concern is present and currently routed to fallback / improve_business / general_overview.
- Wired `extractUserConcern` + `userConcernLeadBullet` into `riskSummary` + `composeRisk`. The composer now prepends three bullets when a concern is present:
  1. "You said it first: supplier dependency" (the lead bullet)
  2. "Mitigation actions for 'supplier dependency'" (4-step playbook)
  3. "Other risks the system sees (after your stated concern)" (a label bullet so the user reads the layered view)

**Before (Q11).**
> "I read your question ... closest intent I found matches the general overview."

**After (P1.4 wired).**
> **You said your biggest worry is supplier dependency** — that leads the response, then the rule-engine layer follows. Sorted by impact. Top 3 below.
>
> Findings:
> 1. **You said it first: supplier dependency** — Matches critical risk in your register — "Single supplier dependency". This is the headline, not a footnote.
> 2. **Mitigation actions for "supplier dependency"** — (1) Map the exposure (single-source %, top-3 customer %, etc.). (2) Qualify an alternative. (3) Lock a contractual fallback. (4) Re-review the risk register weekly.
> 3. **Other risks the system sees (after your stated concern)** — We layer these in next — your stated concern is never buried beneath generic rule firings.
> 4. Single supplier dependency (Critical · impact High)
> 5. No digital storefront (High · impact Medium)

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — 2 new exports.
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — extended `riskSummary` + `composeRisk` with prompt parameter and lead-bullet injection.
- `D:\MSME\UrsAi\frontend\features\assistant\classify-query.ts` — no classifier changes (the re-route hook in consultant.ts catches fallback-style concerns before they reach the fallback composer).

---

### P1.5 — B2B vs B2C marketing adaptation

**Issue.** Q18b "What about digital marketing specifically for someone who sells to retailers?" answered identically to Q18a "Tell me about marketing" — both produced the same generic "Run paid social on one channel first" advice. The H4.1 report flagged this in §3 weakness #9.

**Root cause.** `composeMarketing` produced a single fixed list of generic recs (paid social / 30-day content calendar / referral program) regardless of whether the user's customer is a business (B2B) or a consumer (B2C). `detectAudience` was defined in `assistant-p0.ts` but never called.

**Fix.**
- The `detectAudience(prompt, industry)` helper already existed in `assistant-p0.ts` — extended `assistant-p0.ts` with two new exports built on top:
  - `audienceMarketingBullets(adapt)` — returns 3 audience-specific ConsultantBullets. B2B: "Pick 10 named target accounts and run ABM / Attend one industry trade fair per year / Stand up a referral partner program". B2C: "Verify + optimise your Google Business Profile / Post 3-5 Reels per week + WhatsApp catalogue / Collect 10+ Google reviews". Unknown: both paths clearly labelled.
  - `audienceSummary(adapt, legalName)` — returns a B2B / B2C / unknown-tagged summary opener that names the cadence ("B2B cycles run 30-180 days; expect 5-10 nurture touches per opportunity.").
- Wired `detectAudience(...) + audienceSummary(...) + audienceMarketingBullets(...)` into `marketingSummary` + `composeMarketing` in `consultant.ts`. The composer now calls `asBulletFor(...)` on each audience-specific bullet (idempotent).
- Extended the `marketing` keyword bucket in `classify-query.ts` with `"b2b customers"`, `"b2c customers"`, `"b2b marketing"`, `"b2c marketing"`, `"get more customers"`, `"how do i get customers"`, `"how to get customers"`, `"lead gen"` so a B2B/B2C prompt routes to marketing at all (without this, the prompt lands in fallback and the audience detector is bypassed).

**Before (Q18b).**
> "Marketing plan for **Acme Textiles**. We rank the channel mix by customer-acquisition-cost parity — first-principles, not vibes."
>
> Recommendations: "Run paid social on one channel first / Build a 30-day content calendar / Set up a referral program."

**After (P1.5 wired, B2B).**
> "Marketing plan for **Acme Manufacturing** — calibrated for a **B2B** audience. B2B cycles run 30-180 days; expect 5-10 nurture touches per opportunity."
>
> Recommendations: **"Pick 10 named target accounts and run ABM" — LinkedIn outreach + personalised landing pages beats broadcast. / Attend one industry trade fair per year / Stand up a referral partner program (15-20% margin share).**

**After (P1.5 wired, B2C).**
> "Marketing plan for **Acme Retail** — calibrated for a **B2C** audience. B2C decision cycles are 0-7 days; speed and proof matter."
>
> Recommendations: **"Verify + optimise your Google Business Profile" / "Post 3-5 Reels per week + WhatsApp catalogue" / "Collect 10+ Google reviews / quarter + run a referral".**

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — 2 new exports.
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — extended `marketingSummary` + `composeMarketing` with prompt parameter and audience adaptation.
- `D:\MSME\UrsAi\frontend\features\assistant\classify-query.ts` — extended `marketing` keyword bucket.

---

### P1.6 — Product help vs business export intent

**Issue.** Q19 "How do I export this conversation?" routed to `export_opportunities` → "Export opportunities for Acme Textiles." The user wanted UI help (where's the export button?). They got a tutorial on exporting textiles. H4.1 §3 weakness #10.

**Root cause.** `classify-query.ts`'s `export_opportunities` bucket matched the literal word "export". The word appears in BOTH business-domain prompts ("export my fabrics") AND product-help prompts ("export this conversation"). No distinction was made.

**Fix.**
- Added a new `product_help` `QueryKind` to `types.ts` (was already present in types.ts; required no type edit).
- Added a `product_help` rule to `classify-query.ts` PLACED BEFORE `export_opportunities` so a "export this conversation" prompt never reaches the export bucket. 31 phrases cover: export conversation / chat / download / PDF / report / profile / analytics / schemes / plan / share / notifications.
- Added a new `product_help` route entry in `consultant.ts` (`productHelpSummary` + `composeProductHelp`) that renders a structured How-to-do-X-in-UrsBiz response (UI steps, not business advice).
- Added a pre-routing hook in `buildConsultantResponse` that runs `detectProductHelp(prompt)` and re-routes to `product_help` regardless of what the classifier returned. This is the second-line safety net.
- Added `product_help` to `NEXT_QUESTIONS`.
- The existing `productHelpBody(topic)` helper (already in `assistant-p0.ts`) provides 7 topic-specific reply templates: export conversation, generate PDF, find report, update profile, use analytics, find schemes, generic UrsBiz help.

**Before (Q19).**
> "Export opportunities for **Acme Textiles** (Small (₹10L–₹2Cr) business). Five priority moves per category, ranked by score-gain."
>
> Findings: "No export-readiness actions surfaced yet — Update the Business Profile with IEC + destination interest."

**After (P1.6 wired).**
> "UrsBiz product help — UI steps, not business advice."
>
> Steps in UrsBiz:
> 1. **Open the conversation toolbar** — Look for the Export button on the conversation header (top-right of the chat panel).
> 2. **Choose Markdown / Text / JSON** — Markdown preserves structure; plain text is for copy-paste; JSON is for archival.
> 3. **Click to download** — The browser saves the file to your Downloads folder — no upload, fully local.
> 4. **Search within the conversation** — Use the search box on the toolbar to find a specific user or assistant message.

Same answer shape for "How do I generate a PDF report?":
> "UrsBiz doesn't export the chat as a PDF directly, but you can do it in two clicks: (1) Export the conversation as Markdown first. (2) Open the .md file in any editor and Print → Save as PDF. Or: (3) Export as JSON and convert with pandoc — pandoc chat.json -o chat.pdf."

**Files changed.**
- `D:\MSME\UrsAi\frontend\features\assistant\classify-query.ts` — added `product_help` rule placed before `export_opportunities`.
- `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` — added `product_help` route entry + `productHelpSummary` + `composeProductHelp` + `NEXT_QUESTIONS.product_help` + the pre-routing hook.
- `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` — no new exports; `detectProductHelp` and `productHelpBody` were already present from P0.

---

## Verification matrix — 10 prompts from the brief + 11th action-plan integrity + 4 P0 regression checks

| # | Test | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Tirupur textile export ("I'm a Tirupur textile manufacturer. How do I start exporting my fabrics?") | routed `export_opportunities` + textile/export vocab | kind=export_opportunities, matches textile/apparel/garment/fabric/trims/tirupur/yarn/spinning, matches export/iec/hs code/buyer/freight/tirupur/ecgc/fieo, summary references Textiles & Apparel vocabulary | PASS |
| 2 | Manufacturing supplier-risk ("My biggest worry is a single yarn supplier going out of business." with Manufacturing bundle) | routed risk + manufacturing vocab | kind=risk, matches manufacturing/iso/gem/supplier/component/oem/factory | PASS |
| 3 | Retail digital marketing ("How do I get more customers through digital marketing for my retail store?" with Retail bundle) | routed marketing + retail vocab | kind=marketing, matches retail/kirana/shop/d2c/ecommerce/wholesale/store | PASS |
| 4 | B2B marketing ("How do I get B2B customers for my industrial manufacturing business?") | routed marketing + B2B channel set | kind=marketing, matches linkedin/abm/trade fair/named account/etc. | PASS |
| 5 | B2C marketing ("How do I get more retail customers through B2C marketing?") | routed marketing + B2C channel set | kind=marketing, matches gbp/instagram/whatsapp/reviews/local seo/retention | PASS |
| 6 | ₹1.5 Cr → ₹3 Cr ("I want to grow from ₹1.5 Cr to ₹3 Cr over the next 12 months.") | routed `growth_target`, current=₹1.5 Cr, target=₹3 Cr, gap shown, scenario language, no guaranteed-revenue claim, 4-week plan | kind=growth_target, current ₹1.5 Cr surfaced, target ₹3 Cr surfaced, "gap" present, scenario language ("to target" / "potential path" / "assuming"), no "guarantee" / "will reach" claim, weeks emitted: 4 | PASS |
| 7 | "My biggest worry is supplier dependency. How do I manage this?" | routed risk, concern leads findings, mitigation actions present | kind=risk, leadIdx=0 (user-concern bullet is the first bullet), supplier dependency text surfaced, mitigation actions present (map exposure / qualify alternative / contractual fallback) | PASS |
| 8 | "What should I do this month?" | routed planning / what-first, no regression | kind=what_first (after adding the "this month" phrase to the what_first bucket in classify-query.ts; without this, the prompt landed in fallback — that was an uncovered P0-preexisting gap surfaced by the brief's test set #8, fixed in P1) | PASS |
| 9 | "How do I export this conversation?" | routed `product_help`, MUST NOT be `export_opportunities` | kind=product_help, UI-export guidance present (export button / markdown / json / downloads), does NOT match IEC / shipping bill / HSN / export readiness (i.e. NO business-export text was emitted) | PASS |
| 10 | "How do I generate a PDF report?" | routed `product_help`, PDF-generation guidance | kind=product_help, matches pdf / markdown / print / pandoc | PASS |
| 11 | Action-plan integrity (every emitted week over 7 probes × 2-4 weeks each) | weekNumber + weekLabel + objective + actions, NEVER undefined / null / empty | 12 weeks inspected across 7 prompts; every week has weekNumber (number) + weekLabel (string starting with "Week N — Phase") + objective (string) + actions (string[]). No undefined / null / empty labels. Sample: `weekNumber=1 | weekLabel="Week 1 — Baseline + Gap" | objective="Quantify the  2× current revenue gap..." | actions=3` | PASS |

### P0 regression matrix (must still work — see `SPRINT_H4_2_P0_REPORT.md`)

| Test | Description | Result |
|------|-------------|--------|
| P0.1 | Decision cards non-empty for `decision_hire` / `decision_expand` / `decision_loan` (3/3 verdicts + why + risks + roi + timeline + confidence) | 3/3 PASS |
| P0.2 | Fallback rescue: 5 prompts that used to hit fallback now rescue to growth_target / scaling / finance / operations / export_opportunities | 5/5 PASS |
| P0.3 | Memory continuity banners for "Earlier you talked about X", "As we discussed ...", "You mentioned Y earlier" with recentTopics passed | 3/3 PASS |
| P0.4 | Source attribution: 15 QueryKinds × `(sources.length > 0 AND no "Drawn from the X payload." placeholder)` | 15/15 PASS |

### Audience detector unit coverage (P1.5 sanity)

| Prompt + industry | Expected mode | Actual | Result |
|--------------------|---------------|--------|--------|
| "I sell to retailers and distributors" + "Manufacturing" | B2B | B2B | PASS |
| "I sell to end consumers via Instagram and WhatsApp" + "Retail / D2C" | B2C | B2C | PASS |
| "Help me with marketing" + null | unknown | unknown | PASS |

---

## P1 verifier results

```
$ node "C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1.js"

[SUMMARY]
PASS: 44
FAIL: 0

hermes-verify-h4-2-p1 result: PASS

[exit code]
VERIFY_EXIT=0
```

The verifier lives at `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1.js` (cleans up its own stub files on exit so the project tree is left untouched). The bundled compiled output lives at `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1-build\`. The captured stdout is at `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1-stdout.txt` (134 lines, 8,444 bytes).

## Canonical gate results

|| Command | Result |
||---------|--------|
|| `npm run type-check` (`tsc --noEmit`) | exit 0, zero errors |
|| `npm run lint` (`next lint`) | exit 0, only the two pre-existing marketing warnings (`ArrowRight` / `Smartphone` unused) |
|| `npm run build` (`next build`) | exit 0, "✓ Compiled successfully in 7.2s", 20/20 routes prerendered, `/assistant` at 53.9 kB / 184 kB First Load |
|| `node "C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1.js"` | exit 0, 44/44 PASS |

## Files changed this sprint

|| File | Change |
||------|--------|
|| `D:\MSME\UrsAi\frontend\features\assistant\assistant-p0.ts` | **EXTENDED** — 13 new exports (industry adaptation table, matchIndustry, industryGreetingLine, industryPlaybookBullets, extractGrowthTarget, formatInr, GROWTH_LEVERS, growthTargetWeeks, growthTargetBody, audienceSummary, audienceMarketingBullets, extractUserConcern, userConcernLeadBullet, normalizeActionWeek(s), defaultPhaseFor) + RawActionWeek/NormalizedActionWeek interfaces + PHASE_OBJECTIVES lookup (21 entries). All pure functions; no I/O. |
|| `D:\MSME\UrsAi\frontend\features\assistant\consultant.ts` | **EXTENDED** — imports the P1 helpers; added 3 pre-routing hooks (P1.6 product_help / P1.3 growth_target / P1.4 user-concern); wired `industryGreetingLine` + `industryPlaybookBullets` into 5 composers (growth, export, scaling, improve, marketing); wired `detectAudience` + `audienceSummary` + `audienceMarketingBullets` into marketing; wired `extractUserConcern` + `userConcernLeadBullet` into risk; added `growth_target` + `product_help` ROUTES entries + composers; added NEXT_QUESTIONS entries; refactored `actionWeeksFromRecommendation` to type intermediate `raw` as `LegacyWeek[]` and pipe through `normalizeActionWeeks(raw)` on the way out. |
|| `D:\MSME\UrsAi\frontend\features\assistant\classify-query.ts` | **EXTENDED** — added `product_help` rule (placed BEFORE `export_opportunities`, 31 phrases); added `growth_target` rule (10 phrases for `from ₹` / `to ₹` / `reach ₹` / etc.); extended `marketing` rule with b2b/b2c/get-customers phrases; extended `what_first` rule with "this month" / "this quarter" / "what should i do this month" (test set #8 uncovered a pre-existing gap here). |
|| `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1.js` | **NEW** (under %TEMP%, not a project file) — ad-hoc verifier for the 10-prompt P1 test set + P1.2 action-plan integrity probe + 4 P0 regression checks. Cleans up its own stub files on entry and exit. |
|| `C:\Users\Win\AppData\Local\Temp\hermes-verify-h4-2-p1-stdout.txt` | **NEW** (under %TEMP%) — 134-line captured stdout from the verifier run. |
|| `D:\MSME\UrsAi\SPRINT_H4_2_P1_REPORT.md` | **NEW** — this report. |

**No new modules, no new dependencies, no backend / API / DB / auth / routing / schema changes, no assistant-architecture replacement.** The single source-of-truth file added during P0 (`assistant-p0.ts`) absorbed every P1 helper.

## Bugs uncovered and fixed during P1 verification

The verifier initially surfaced 4 failures:

1. **P1.5.a / P1.5.b** — B2B marketing prompt routed to `fallback`. Root cause: `marketing` keyword bucket in `classify-query.ts` lacked "b2b customers" / "get b2b customers" phrases. **Real bug.** Fixed by extending the bucket. Re-test → PASS.
2. **P1.4.b** — "What should I do this month?" routed to `fallback`. Root cause: pre-existing gap in the `what_first` bucket (no "this month" phrase). **Test set #8 in the brief explicitly required this — the gap was uncovered by P1, fixed in P1.** Re-test → PASS.
3. **P1.1.d** — "industry-anchored, not generic" assertion. Root cause: verifier assertion was over-restrictive (mistakenly required absence of "India Mart", which is a legitimate textile channel). **Verifier bug.** Corrected the assertion to check for textile/apparel/garment/tirupur/fabric vocabulary. Re-test → PASS.

All 3 fixes were also independently re-run through the canonical gates (type-check / lint / build) — still green.

## Remaining limitations

1. **Stub files at start of verifier run.** The verifier creates `frontend/types/stub-*.ts` files during the esbuild bundling step and deletes them both before and after the run. If the verifier is killed mid-run, these stubs may be left behind. The P0 verifier had the same behaviour; the P1 verifier adds a `process.on("exit", ...)` cleanup that fires on normal exit only. A future hardening step would be to use TypeScript's built-in `--paths` flag (no stub files at all).
2. **`user-concern` lead bullet matches critical risks by keyword substring overlap.** If the user phrases a concern that's not in any critical_risk[].title (e.g. "my biggest worry is cash flow"), the bullet still surfaces with the generic "we acknowledge this before the rule-engine ranking" subtitle — no fabrication, but no critical-risk match either. Future improvement: fall back to matching against `medium_risks[].title` and `high_risks[].title` as well.
3. **`growth_target` re-route hook requires goal-shaped prompt.** A prompt like "How do I reach ₹3 Cr revenue?" (single-number, no "from X") routes to `growth_target` because of the "reach ₹" classifier phrase. A more aggressive version would re-route any prompt with a single rupee amount and the verb "reach / target / hit / achieve" — but the brief explicitly says scenario language is fine without a gap, so this is left untouched.
4. **Industry matching is substring-based, not semantic.** "Tirupur" matches Textiles & Apparel via the matchers list. "Tirupur" in a non-textile context (e.g. a logistics company) would still match — but `matchIndustry` is called against `bundle.twin.identity.industry`, not against the prompt, so the matcher always sees the user's actual industry. Safe in practice.
5. **P1.1 doesn't yet adapt `digital_transformation`, `finance`, `gst`, `government_schemes`, or `compliance` composers.** The brief specifically calls out growth / export / marketing / scaling as the four industry-aware surfaces. `improve_business` was also adapted because test set #1 ("how do I get more customers through digital marketing for my retail store") flows through `marketing` regardless of the underlying kind. If the user wanted industry-adaptation on every single route, that's a follow-up.
6. **P1.4 mitigation bullets are generic 1–4 numbering (Map / Qualify / Lock / Review).** They are written for the "supplier dependency" case. For other concern topics (cash flow / hiring / cyber / fire), the same 4 steps apply with substitution, but the wording is unchanged. Future improvement: emit concern-keyword-specific mitigation steps.
7. **B2B/B2C detection uses substring heuristics.** A prompt that mentions only "marketing" (with no B2B/B2C signal) falls back to the `audience.unknown` path and returns both labels clearly tagged. This is the right behaviour per the brief; the only limitation is that it does not interrogate the user with a clarifying question when the industry is also ambiguous.

## Final H4.2-P1 status

**P1 COMPLETE.**

All six P1 issues identified in the H4.1 evaluation are fixed, with deterministic ad-hoc evidence (44/44 tests pass) and clean canonical verification (type-check / lint / build all green). All P0 fixes preserved (decision cards, fallback rescue, memory continuity, sources all still 100%). No new modules in the repo (the single P0 module `assistant-p0.ts` absorbed every P1 helper). No backend / API / DB / auth / routing / schema changes.

The H4.1 evaluation report's overall composite score of 2.6/5 should now read higher across the six affected questions; a fresh evaluation against the real `/assistant` UI would re-score Q2, Q9–Q11, Q12, Q13, Q18b, and Q19 upward.

**The assistant is now substantially more useful across the full P1 + P0 requirement set.** A re-run of the H4.1 evaluation script would not be a fair comparison (the H4.1 fixture was hand-built for the original bundle; the P1 wiring is the orchestrator's improvement on top). The next sprint that wants a fresh score should re-issue the H4.1 test set against the live `/assistant` route and grade it against the same rubric.
