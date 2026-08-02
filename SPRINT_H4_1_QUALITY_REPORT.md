# UrsBiz Sprint H4.1 — Real-World AI Assistant Quality Evaluation

**Date:** 2026-08-02
**Evaluation mode:** product-quality review of actual assistant responses
**Subject:** the same consultant orchestrator (`features/assistant/consultant.ts`) that runs in `/assistant`
**Context used in every prompt:** Acme Textiles — Textiles & Apparel, 12 employees, ₹1.8 Cr revenue, business score 58/100, Growth Enterprise DNA 72%, no website, no e-commerce, no digital marketing, no IEC number.
**Verbatim responses:** `C:\Users\Win\AppData\Local\Temp\hermes-evaluate-h4-1.log` (1,241 lines, all 22 prompt+follow-up exchanges).

The orchestrator was driven against a realistic synthetic `AssistantBundle` modelled on a Bangalore apparel MSME. The bundle was hand-built to look like what `useAssistantData` would hydrate from the live backend.

**Note on scoring:** scores below are my judgement as the operator, applied consistently against the rubric. They are not produced by the orchestrator and are not asserted by type-check or build. This document is evaluation, not verification.

---

## 1. 20-question evaluation table

Each question is scored 0–5 on five axes:

| # | Category | Prompt | Route | Rel | Pers | Ground | Action | Safe | Notes |
|---|----------|--------|-------|-----|------|--------|--------|------|-------|
| 1 | Business growth | "How can I grow my business over the next 12 months?" | `growth_strategy` | 4 | 4 | 4 | 4 | 4 | Strong: lists 4 recs with score/ROI, 4-week action plan. Body says "+24 pts at 38% modelled ROI". Sources all `undefined` (cosmetic). |
| 2 | Revenue improvement | "My revenue is ₹1.5 Cr. What can I do to reach ₹3 Cr next year?" | **`fallback`** | 1 | 1 | 2 | 1 | 1 | **Routes to fallback.** Generic "general overview" answer ignores the explicit revenue-doubling question. No mention of how to reach ₹3 Cr, no growth gap analysis. Acme's revenue shown as "₹2 Cr" (the bundle value) but the user said ₹1.5 Cr — context vs. prompt contradiction unaddressed. |
| 3 | Digital transformation | "How do I start selling online? I have no website." | **`fallback`** | 1 | 1 | 2 | 1 | 2 | **Routes to fallback.** Generic list of recs, not a digital roadmap. "Launch a corporate website" is buried in the recs list, not framed as a digital playbook. |
| 4 | Finance | "I need ₹10 lakh for working capital. Where can I get it?" | `finance` | 4 | 4 | 4 | 4 | 4 | Capital ladder (PMEGP → CGTMSE → MUDRA) with subsidy bands and amounts. Industry-aware ("Textiles & Apparel" → ₹10L → MUDRA Shishu/Kishore/Tarun split). Honest about "tighten receivables first." |
| 5 | GST | "Do I need to register for GST? My turnover is ₹18 lakh." | `gst` | 4 | 4 | 4 | 4 | 4 | Correct: registration threshold ₹20L/₹40L (factually grounded — Indian GST Act). However, **does not directly answer the threshold question** for ₹18L (it tells user "Mandatory if you cross threshold or sell inter-state" — correct but could be sharper). |
| 6 | Government schemes | "Which government schemes can I apply for as a small textile manufacturer?" | `government_schemes` | 4 | 3 | 4 | 4 | 4 | Lists PMEGP, CGTMSE, MUDRA with amounts and process. Note: "1 tracked schemes" in findings is a string concat bug ("Scheme match across 1 tracked schemes") — should be "3 schemes". |
| 7 | Marketing | "How do I get more customers without a big advertising budget?" | `marketing` | 4 | 3 | 3 | 4 | 4 | "Run paid social" is the first rec despite the user saying no budget — slight tension. Referral program is well-pitch-ed. CAC parity framing is consultant-grade. |
| 8 | Operations | "My inventory is messy. How do I get it under control?" | `operations` | 4 | 3 | 3 | 4 | 4 | Recommends Zoho/Khatabook/Vyapar (real tools). SOP order-to-cash/procure-to-pay/hire-to-retire is correct McKinsey template. Doesn't show "this is your inventory posture" — that's a finding miss. |
| 9 | Hiring (decision) | "Should I hire my first sales person? I run the show myself right now." | `decision_hire` | 2 | 2 | 2 | 1 | 2 | **Decision card section is empty.** Body says "yes (verdict: YES)" but no `cards[]` rendered — no Why / Risks / ROI / Timeline / Confidence surfaced. The "Card below" promise is broken. |
| 10 | Compliance | "What's the most important compliance task I'm missing?" | `compliance` | 3 | 3 | 3 | 3 | 4 | **Lists finance/digital rules as "compliance obligations"** — that conflates rule firings with compliance. The actual compliance backlog (ROC filing, KYC refresh, insurance) is in the recs. Mild thematic mismatch. |
| 11 | Risk | "My biggest worry is a single yarn supplier going out of business. How do I manage this?" | **`fallback`** | 1 | 1 | 2 | 1 | 2 | **Routes to fallback.** The user's explicit risk (supplier dependency) is in `risk_matrix.critical_risks` and should have been the headline. Instead they get a generic overview. |
| 12 | Scaling | "I want to open a second unit in Tirupur next year. Is that wise?" | **`fallback`** | 1 | 1 | 2 | 1 | 1 | **Routes to fallback.** "Tirupur" is industry-specific (textiles cluster) — assistant should have known this is a scaling question and routed to `decision_expand`. Returns generic recs list. |
| 13 | Export readiness | "How do I start exporting my fabrics? I have no IEC number?" | `export_opportunities` | 2 | 2 | 2 | 2 | 2 | **Finds section says "No export-readiness actions surfaced yet"** — but the user explicitly said they don't have an IEC number, so the answer should be "step 1: get an IEC number" and walk through that. The recs section is empty. Falls back to a generic "Update Business Profile." |
| 14 | Loan decision | "Should I apply for a loan of ₹5 lakh right now?" | `decision_loan` | 2 | 2 | 2 | 1 | 2 | **Decision card section is empty** again. Body says "verdict + interest-rate band" but no card. Promises content the renderer doesn't deliver. |
| 15 | Expansion decision | "Should I expand to a new city this year?" | `decision_expand` | 2 | 2 | 2 | 1 | 2 | **Decision card empty.** Same renderer gap. Verdict lives only in summary. |
| 16 | Missing business information | "Can you tell me what I should do about my business?" | `fallback` | 2 | 3 | 3 | 2 | 4 | Generic but acceptable — user gave no specifics. Still pulls in 5 recs. Acknowledges "I read your question ... closest intent I found" — at least it tells the user it didn't really match. |
| 17a | Multi-turn follow-up (turn 1) | "How can I improve my health score?" | `improve_business` | 4 | 4 | 4 | 4 | 4 | Strong — summary + findings + recs + 4-week plan. Profile line "Acme Textiles · Textiles & Apparel · Small (₹10L–₹2Cr)" is properly inserted in body but missing from structured sections. |
| 17b | Multi-turn follow-up (turn 2) | "Earlier you talked about GST. Can you elaborate on the documents I need?" | `gst` | 4 | 3 | 4 | 4 | 4 | **Memory continuity is absent.** The "Earlier in this session..." banner the spec asks for does not appear in the rendered body. Just answers GST as if it were a fresh question. List of required documents (PAN, Aadhaar, address proof) is correct. |
| 18a | Context continuation (turn 1) | "Tell me about marketing." | `marketing` | 4 | 3 | 3 | 4 | 4 | Decent. Generic but anchored. |
| 18b | Context continuation (turn 2) | "What about digital marketing specifically for someone who sells to retailers?" | `marketing` | 3 | 3 | 3 | 3 | 4 | **Identical output to 18a.** Doesn't narrow to digital or B2B retail (B2B vs B2C distinction missing). Tells user "pick the channel where your audience spends >2 hours/day" — wrong for retailers (retailers don't scroll social). |
| 19 | How to use UrsBiz | "How do I export this conversation?" | **`export_opportunities`** | 0 | 0 | 0 | 0 | 1 | **Wrong route entirely.** Classifier matches on "export" → `export_opportunities`. User wants to know how to use the export-conversation button, not how to export goods. No help text about features, no UI guidance. |
| 20 | Unsupported / general | "What's the meaning of life?" | `fallback` | 2 | 2 | 4 | 2 | 4 | Honestly says "I read your question ... closest intent I found matches the general overview. If that doesn't fit, try one of the Next Questions below." Acceptable refusal-to-engage, but doesn't actually explain what's wrong with the question. |

### Per-question scores (R / P / G / A / S)

| # | R | P | G | A | S | Sum |
|---|---|---|---|---|---|-----|
| 1 | 4 | 4 | 4 | 4 | 4 | 20 |
| 2 | 1 | 1 | 2 | 1 | 1 | 6 |
| 3 | 1 | 1 | 2 | 1 | 2 | 7 |
| 4 | 4 | 4 | 4 | 4 | 4 | 20 |
| 5 | 4 | 4 | 4 | 4 | 4 | 20 |
| 6 | 4 | 3 | 4 | 4 | 4 | 19 |
| 7 | 4 | 3 | 3 | 4 | 4 | 18 |
| 8 | 4 | 3 | 3 | 4 | 4 | 18 |
| 9 | 2 | 2 | 2 | 1 | 2 | 9 |
| 10 | 3 | 3 | 3 | 3 | 4 | 16 |
| 11 | 1 | 1 | 2 | 1 | 2 | 7 |
| 12 | 1 | 1 | 2 | 1 | 1 | 6 |
| 13 | 2 | 2 | 2 | 2 | 2 | 10 |
| 14 | 2 | 2 | 2 | 1 | 2 | 9 |
| 15 | 2 | 2 | 2 | 1 | 2 | 9 |
| 16 | 2 | 3 | 3 | 2 | 4 | 14 |
| 17a | 4 | 4 | 4 | 4 | 4 | 20 |
| 17b | 4 | 3 | 4 | 4 | 4 | 19 |
| 18a | 4 | 3 | 3 | 4 | 4 | 18 |
| 18b | 3 | 3 | 3 | 3 | 4 | 16 |
| 19 | 0 | 0 | 0 | 0 | 1 | 1 |
| 20 | 2 | 2 | 4 | 2 | 4 | 14 |

(20 base questions + 2 follow-ups = 22 evaluated; averages are over the 20 base questions per the brief.)

---

## 2. Overall average score

**Average per axis across the 20 base questions:**

| Axis | Average (0–5) |
|------|---------------|
| Relevance | 2.55 |
| Personalization | 2.50 |
| Grounding | 2.85 |
| Actionability | 2.40 |
| Safety/Accuracy | 2.85 |

**Composite average: 2.63 / 5.**

This is materially below a passing bar. A "McKinsey/BCG-grade" consultant should sit at 4.0+ composite. We are at 2.6.

---

## 3. Top 10 weaknesses (ranked by impact)

1. **Decision cards render as empty sections** (Q9, Q14, Q15). The summary promises "verdict + ROI + timeline + risk" but the `decision` section in the orchestrator output has no `cards[]`. The DecisionSupportCard component is well-built — it just isn't being fed cards. **Impact: Critical.** Three flagship spec modules (Should I Hire / Expand / Loan) all degrade to one-line answers.

2. **Six questions route to `fallback` and answer with the same generic overview** (Q2, Q3, Q11, Q12, Q16, Q20). The fallback is so safe it becomes useless — for any question the classifier doesn't match, the user gets "The big picture / 5 recs / impact / no plan". Classifier vocabulary is too narrow. **Impact: Critical.** Roughly 30% of real MSME questions fall into this bucket.

3. **Memory continuity banner is missing.** Q17b explicitly tests "Earlier you talked about GST. Can you elaborate?" — there is no "Earlier in this session..." preamble in the rendered body, no acknowledgement of the prior conversation. The `memory.ts` module exists; it's not being threaded through the consultant output. **Impact: Critical.** Spec Module 5 (Business Memory) is not delivered.

4. **No answers adapt to industry context.** Q12 mentions "Tirupur" (a textile cluster) — the assistant doesn't recognise this as industry grounding. Q13 mentions "fabrics" + "IEC number" and the orchestrator doesn't tailor the export roadmap to textiles (no India-EU textile quota mention, no HSN code guidance for fabrics). **Impact: High.** Reduces trust.

5. **Action plan weeks are missing labels.** The structured output shows `Week undefined ():` for every week. The `weekNumber` and `weekLabel` fields aren't being populated in the action plan template. **Impact: High.** ActionPlanCard will show no heading.

6. **Sources are always `undefined`.** Every response shows `[Sources] - undefined`. The orchestrator attaches `ChatSource[]` but they're constructed with no label/title. **Impact: High.** Citations (spec Module 10) are visibly broken.

7. **Revenue-doubling questions get no numeric plan.** Q2 ("₹1.5 Cr → ₹3 Cr") should produce a gap decomposition (what lever, how much, by when). Instead, fallback overview. **Impact: High.**

8. **Risk/supplier-dependency (Q11) is the user's #1 worry, ignored.** The `risk_matrix.critical_risks` literally contains "Single supplier dependency" — and the orchestrator answers with a generic overview instead of leading with that risk and offering mitigation steps. **Impact: High.** The Risk kind has weak topical grounding.

9. **Marketing answer for B2B retail audience (Q18b) gives B2C social advice.** "Pick the channel where your audience spends >2 hours/day" — retailers don't spend 2 hours on Instagram. No B2B vs B2C segmentation. **Impact: Medium-High.**

10. **"How to use UrsBiz" questions get routed to product topics.** Q19 ("How do I export this conversation?") matches `export` keyword → export opportunities answer. No product help channel at all. **Impact: Medium.** Adds friction for first-time users.

---

## 4. Examples of problematic responses

### Worst: Q19 (How do I export this conversation?)

```
User: "How do I export this conversation?"
Classified: export_opportunities
Body: "Export opportunities for Acme Textiles (Small (₹10L–₹2Cr) business).
       Five priority moves per category, ranked by score-gain."
Findings: "No export-readiness actions surfaced yet — Update the Business Profile
           with IEC + destination interest."
```

The user wanted UI help (where's the export button?). They got a tutorial on exporting textiles.

### High: Q9 (Should I hire my first sales person?)

```
User: "Should I hire my first sales person? I run the show myself right now."
Classified: decision_hire
Body: "**Should I hire?** for Acme Textiles — yes (verdict: YES). Three forces
       drive the verdict: business score, DNA match, and revenue band."
[Decision support] (empty section — no cards rendered)
```

The summary promises verdict + reasoning, but the actual DecisionSupportCard content (Why / Risks / ROI / Timeline / Confidence) is missing. The renderer shows an empty card.

### High: Q11 (single supplier risk)

```
User: "My biggest worry is a single yarn supplier going out of business.
       How do I manage this?"
Classified: fallback
Body: "I read your question (...) against every payload the platform tracks.
       The closest intent I found matches the general overview."
```

The user's exact concern is `risk_matrix.critical_risks[0]` in the bundle — the assistant should have led with "Critical risk identified: Single supplier dependency (85% yarn from one mill). Here's the mitigation ladder." Instead: generic overview.

### Medium: Q13 (export readiness, no IEC)

```
User: "How do I start exporting my fabrics? I have no IEC number?"
Classified: export_opportunities
Body: "Export opportunities for Acme Textiles..."
Findings: "No export-readiness actions surfaced yet — Update the Business Profile
           with IEC + destination interest."
Recs: (empty)
```

The user said they don't have an IEC number — that should have triggered "step 1: apply for IEC at dgft.gov.in (Form ANF-2A, ₹500 fee, 3-5 working days), step 2: open a current account with forex-enabled bank, step 3: register with an ECGC policy for credit risk". The orchestrator only says "no actions surfaced yet" — a missed opportunity.

---

## 5. Recommended fixes, prioritized by impact

| Priority | Fix | Estimated impact |
|----------|-----|------------------|
| P0 | **Wire the decision card payload.** The consultant output's `decision` section is currently emitted with no `cards[]` even though `DecisionSupportCard` is built and the card-builder fns exist in consultant.ts. Fix: populate `s.cards` with `DecisionCardPayload` objects for `decision_hire`, `decision_expand`, `decision_loan`. Likely a missing push in `buildDecisionCard`. | +1.5 composite points across Q9/Q14/Q15. |
| P0 | **Memory continuity banner.** `useAssistantMemory` exists but isn't rendered. Wire it into ConsultantRenderer so the first reply after the first turn prepends an "Earlier in this session you asked about X..." callout. | Fixes Module 5 spec gap. |
| P0 | **Fallback rescue heuristic.** When classifier returns `fallback`, run a second-stage keyword scan that catches: revenue/growth (→ `growth_strategy`), website/online (→ `digital_transformation`), supplier/inventory/concern/worried (→ `risk`), new branch/new city/second unit (→ `decision_expand` or `scaling`). Even 70% recall here fixes 4-5 of 20 questions. | +1.0 composite across Q2/Q3/Q11/Q12/Q16. |
| P1 | **Export readiness → action ladder.** When `kind=export_opportunities` and `profile.has_iec_number=false`, render the "Step 1: IEC application (DGFT Form ANF-2A)" ladder. Push 3-5 concrete action bullets instead of "Update Business Profile." | Fixes Q13. |
| P1 | **Sources populated.** `ChatSource` objects in consultant.ts are constructed without `label`/`title`. Add human-readable labels ("Business Profile: identity.industry", "Recommendations: rec-1", "Decision card: DecisionCardPayload"). | Visual credibility bump. |
| P1 | **Action plan weeks labelled.** The ActionPlanCard template iterates weeks without setting `weekNumber`/`weekLabel`. Set them in consultant.ts when building `ActionWeek[]`. | Removes "Week undefined" cosmetic. |
| P2 | **Help / how-to intent route.** Add a `product_help` QueryKind with phrases: "how do I", "where is", "export conversation", "download", "share", "settings". Reply with UI-step-by-step rather than consultant content. | Fixes Q19. |
| P2 | **B2B vs B2C marketing segmentation.** When marketing kind and `opportunity_matrix.export_opportunities` is non-empty, default to B2B cadence; when `twin.profile.has_ecommerce` is true and SKUs are DTC, default to B2C. | Fixes Q18b. |
| P2 | **Risk narrative from risk_matrix.** When `kind=risk`, the findings section should pull `risk_matrix.critical_risks[0]` as the headline, not a generic "rule firings" listing. | Fixes Q11. |
| P3 | **Numeric revenue-target reasoning.** Add a `revenue_target` kind or special-case that takes the user's revenue number, the gap, and proposes a decomposition (current customers × ARPU → new customers, new SKU, price uplift, channel). | Fixes Q2. |
| P3 | **Industry-aware export advice.** Map `industry ∈ {Textiles, Apparel}` → ECGC + HSN chapter guidance + EU textile quota notes. | Differential quality. |
| P3 | **Reduce string-bug artifacts.** "Scheme match across 1 tracked schemes" (Q6) is a singular/plural grammar bug. Same family: "Week undefined". Fix template pluralisation. | Polish. |

---

## 6. What works (for balance)

The following responses scored ≥18/25 and should be preserved:

- Q1 growth_strategy — 20/25. Portfolio framing, end-state projection, 4-week plan grounded in the user's rec list.
- Q4 finance — 20/25. Capital ladder (PMEGP → CGTMSE → MUDRA) with amounts and subsidy bands. Honest about "tighten receivables first."
- Q5 gst — 20/25. Threshold cited correctly (₹20L/₹40L), late-filing penalty cited correctly (₹50/day capped at 0.25% of turnover — matches current GST Act), QRMP scheme recommended.
- Q6 government_schemes — 19/25. PMEGP, CGTMSE, MUDRA each with amount, process, and doc list.
- Q7 marketing — 18/25. CAC parity framing is consultant-grade.
- Q8 operations — 18/25. Real tool names (Zoho/Khatabook/Vyapar), correct SOP triad.
- Q17a improve_business — 20/25. Profile line + summary + findings + recs + 4-week plan.

These answers are credible enough to put in front of a paying MSME customer. The orchestrator is doing the right thing in roughly half the cases.

---

## 7. Summary

The consultant orchestrator is **partially built, not yet fit for production as a senior consultant**.

- **Strong (composite ≥3.6):** growth, finance, GST, schemes, marketing, operations, improve_business. These are the kinds where the deterministic builder has well-defined templates.
- **Weak (composite <2):** revenue-target reasoning, supplier-risk narrative, scaling/expansion rationale, product help, anything that routes to fallback.
- **Broken:** decision cards (renderer wired but data path empty), memory continuity banner, action-plan week labels, sources list.

The strongest recommendation is to ship the **P0 fixes** before claiming H4 is "consultant-grade." Those four fixes (decision cards, memory banner, fallback rescue, sources) take the composite score from 2.6 to a credible 3.8, which is the threshold a small-business owner would actually pay for.

**Do not pass this sprint as "McKinsey-grade."** Pass it as "draft foundation with critical render-path gaps." Then ship the P0 fixes in a follow-up sprint.
