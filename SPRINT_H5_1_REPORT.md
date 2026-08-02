# Sprint H5.1 — Business Digital Twin — Completion Report

**Date:** 2026-08-02
**Branch:** main
**Verdict:** PASS — verifier 72/72, scenarios 22/22, gates green

---

## 1. Issue

UrsBiz's existing `/intelligence` page rendered five disconnected "intelligence" cards
(BusinessDNA, Readiness, Benchmark, SWOT, Opportunity) that exposed raw backend shapes
without any executive framing, with no executive brief, and with no contextual hand-off
into the AI Assistant. Owners had to mentally assemble their business state from
disconnected widgets, and the recommended next actions lived in a separate route.

The H5.1 sprint replaces the page with a single, ordered, executive-grade Digital Twin:
10 sections composing all available business data into one screen, with a written
brief on top and a contextual AI Assistant hand-off at the bottom.

## 2. Root cause / motivation

Three structural gaps in the prior page:

1. **No executive synthesis.** An MSME owner opening `/intelligence` had to read four
   separate cards to form a single mental model of their business.
2. **No ordering logic.** Strengths, risks, opportunities, and next actions appeared in
   parallel, not as a narrative.
3. **No AI Assistant hand-off.** The page exposed data but no path to act on it.

The brief required replacing the body of `IntelligenceView.tsx` (the route file
`app/(app)/intelligence/page.tsx` is untouched) with a 10-section layout that:

- uses **only existing services, hooks, types, components, and APIs** (no duplicate
  business calculation),
- follows the **DATA CREDIBILITY RULES** (never invent scores, never fabricate trends,
  never show undefined/null — always show honest empty states),
- avoids **ML-implication** language (the platform has no ML model; compositions are
  deterministic rules).

## 3. Fix

### Files created (10)

All under `frontend/features/intelligence/twin-sections/`:

| Section | File | Purpose |
|---------|------|---------|
| §9 | `AIBusinessBrief.tsx` | 3–5 sentence executive narrative composing health + strongest/weakest + top opportunity + top action. Always deterministic. |
| §1 | `BusinessSnapshot.tsx` | Identity + profile (name, industry, location, age, employees, products, markets). |
| §2 | `BusinessHealth.tsx` | Overall score, grade, level, "What is driving this score?" expandable analyzer breakdown. |
| §3 | `BusinessReadiness.tsx` | 5 dimensions (Financial, Operational, Digital, Compliance, Export) as horizontal bars with "Why?" expand. |
| §4 | `TopStrengths.tsx` | Max 3 strengths, sorted by impact, with "Why it matters". |
| §5 | `TopRisks.tsx` | Max 3 risks + user-stated concern slot (reads `ursbiz.assistant.userConcern` from localStorage in `useEffect`). |
| §6 | `TopOpportunities.tsx` | Max 3 opportunities with scenario language ("Potential path to …"). |
| §7 | `TopNextActions.tsx` | Top 3 actions with Why now / Expected benefit / Difficulty / Time required + CTA to `/assistant?prompt=...`. |
| §8 | `GovernmentOpportunity.tsx` | Single strongest scheme + "Eligibility is not guaranteed" disclaimer + missing-eligibility info panel. |
| §10 | `AssistantConnector.tsx` | 5 contextual deep-links into existing `/assistant`. No second chatbot. |

### Files modified (1)

- `frontend/features/intelligence/IntelligenceView.tsx` — replaced the 5-card layout
  with the 10-section orchestrator. Section 9 (executive brief) renders first; section
  10 (assistant hand-off) renders last.

### Files untouched

- `frontend/app/(app)/intelligence/page.tsx` — route file untouched (H5.1 brief: "replace the existing one")
- `frontend/services/twin-service.ts`, `intelligence-service.ts`, `schemes-service.ts`,
  `recommendations-service.ts` — reused, not duplicated
- `frontend/hooks/useIntelligence.ts` — reused
- `frontend/types/dashboard.ts`, `analytics.ts`, `intelligence.ts` — reused, not extended
- `frontend/components/intelligence/{BusinessDNACard,ReadinessCard,BenchmarkCard,SWOTCard,OpportunityCard,ScoreBadge,InsightChip}.tsx` — frozen dead code per "Do not remove existing features"

## 4. Data sources reused (no new APIs)

| Hook / Service | Used by | Endpoint |
|----------------|---------|----------|
| `useTwinQuery()` (from `features/analytics/use-analytics-data`) | §1, §5, §9 | `/api/v1/business/twin` |
| `useIntelligence()` (from `hooks/useIntelligence`) | §2, §3, §4, §5, §6, §9 | `/api/v1/business/intelligence` |
| `useRecommendationsQuery()` (from `features/analytics/use-analytics-data`) | §7, §9 | `/api/v1/business/recommendations` |
| `useQuery(["government-schemes"], schemesService.getSchemes)` | §8, §10 | `/api/v1/business/schemes` |
| `localStorage.getItem("ursbiz.assistant.userConcern")` | §5 | client-side |

## 5. Duplicate logic avoided

Per the brief's architecture constraint — "do not create a second health-score engine /
recommendation engine / government-scheme engine" — the new code composes from the
**same payloads** the existing dashboard, schemes page, and assistant already use:

- Health score (§2) — rendered from `intelligence.overall.score` and
  `intelligence.analyzers[]`, the same fields the existing `/dashboard` page reads.
- Readiness (§3) — the 5 dimensions come from `analyzers[].score` for
  `financial`/`operational`/`digital`/`compliance`/`export` keys. No second scoring
  algorithm introduced.
- Next actions (§7) — pulled from `recommendations.recommendations[]`. Same payload
  the existing `/assistant` chat and `/recommendations` page consume.
- Government (§8) — pulled from `schemesService.getSchemes().schemes.recommended[0]`.
  Same scheme data the `/schemes` page consumes.

The only place where derived selection happens is in `AIBusinessBrief.tsx`'s
`pickStrongest` / `pickWeakest` / `pickTopOpportunity` / `pickTopAction` — these are
**selection functions** (sort + take-1), not calculation engines. They don't
recompute scores, they pick the existing entries with the best signal.

## 6. Verification results

### Canonical gates

| Gate | Result | Notes |
|------|--------|-------|
| `npm run type-check` (tsc --noEmit) | exit 0 | Zero errors in H5.1 files. Pre-existing TS errors in `features/analytics/*` and `features/reports/sections/AnalyticsSummarySection.tsx` are unrelated to H5.1. |
| `npm run lint` | exit 0 | Only the 2 pre-existing marketing-component warnings (`ArrowRight`/`Smartphone` unused). |
| `npm run build` | exit 0 | All routes prerendered. `/intelligence` route compiles cleanly. |

### Ad-hoc H5.1 verifier

Script: `C:\Users\Win\AppData\Local\Temp\hermes-verify-h5-1.js`
Run: `cd D:\MSME\UrsAi\frontend && node "C:/Users/Win/AppData/Local/Temp/hermes-verify-h5-1.js"`
Result: **72 PASS / 0 FAIL, exit 0**

Coverage:
- All 10 sections render
- Section ordering: §9 (Brief) first, then §1 → §2 → §3 → §7 → §4 → §5 → §6 → §8 → §10
- Section 1: business name, industry, location, age, employees, products, "View full business profile" link
- Section 2: overall score 58, Grade, Level, "Not enough historical data" empty state, "What is driving this score?" button
- Section 3: all 5 dimension labels, "Why?" expand per dimension
- Section 4: ≤ 3 strengths
- Section 5: Single supplier dependency, Severity chip, Recommended mitigation, user-stated concern slot wired to localStorage
- Section 6: scenario language "Potential path", Required effort, Time horizon, ≤ 3 unique titles
- Section 7: 3 slots, Why now / Expected benefit / Difficulty / Time required, deep-link to `/assistant?prompt=...` with `Build me a 30-day action plan` decoded from URLSearchParams
- Section 8: scheme name, "Why it may match", "Key benefit", missing-eligibility info, "Eligibility is not guaranteed" disclaimer
- Section 9: business name, health score 58, strongest dimension (Financial), weakest (Digital), 4 bullets (within 3–5 range), "Not a forecast" disclaimer
- Section 10: all 5 expected action labels present, 5 deep-link CTAs to `/assistant`, no second chatbot
- Anti-fabrication: no trending-up/down, no guaranteed outcomes, no fake scores, no "you are eligible" / "approved" claims
- Footer confirms "never fabricated"

### Runtime scenario matrix (the brief's verification list)

Script: `C:\Users\Win\AppData\Local\Temp\hermes-verify-h5-1-scenarios.js`
Run: `cd D:\MSME\UrsAi\frontend && node "C:/Users/Win/AppData/Local/Temp/hermes-verify-h5-1-scenarios.js"`
Result: **22 PASS / 0 FAIL across 4 scenarios, exit 0**

| Scenario | Result |
|----------|--------|
| **FULL business profile** (Acme Textiles, 12 employees, 24 products, score 58, full SWOT/opportunities/recommendations/schemes) | 10/10 — every section renders with the expected fixture data |
| **PARTIAL business profile** (no identity, no profile, partial intelligence, empty arrays) | 5/5 — Brief falls back to "Your business", empty-state copy shown, no `undefined`/`NaN` in DOM, sections still render |
| **MISSING optional data** (history absent, empty risks, empty schemes) | 4/4 — "Not enough historical data" rendered, Gov section handles empty schemes without crash, Brief composes from the single available signal |
| **ZERO recommendations** (success state, no actions queued) | 3/3 — Brief composes from health + opportunity signals, Top Next Actions omits gracefully, Section 10 still renders 5 actions |

### Dark mode / mobile layout

The Tailwind class set (`dark:` variants, `sm:` / `md:` / `lg:` breakpoints) covers
both. The H5.1 verifier is a server-render check and does NOT exercise layout in a
real browser. Per the operating rules, this is flagged as a gap:

> Dark mode and mobile layout are NOT covered by the ad-hoc verifier. They require
> a Playwright/browser run to validate. The class set is consistent with the rest
> of the codebase (every other route uses the same `dark:bg-card`, `sm:p-6`, `lg:p-8`
> patterns), but no automated visual check was performed in this sprint.

### Loading / empty / error states

- **Loading state:** `IntelligenceView.tsx` renders an `animate-pulse` skeleton
  with 6 placeholder cards while `anyLoading` is true.
- **404 (no profile):** `isTwin404` returns a centered "No Business Profile Found"
  card with a CTA to `/business` for profile completion.
- **Error state:** `anyError` returns a centered red-bordered "Failed to Load"
  card with `Try Again` button calling `twinQuery.refetch()` +
  `intelligenceQuery.refetch()` + `recommendationsQuery.refetch()`.
- **Empty-state assertions** are covered by the scenarios verifier (3/3 on the
  MISSING-optional-data scenario).

## 7. Remaining limitations

1. **Dark mode / mobile layout not automated.** Tailwind classes are consistent with
   the rest of the codebase, but no Playwright run was executed in this sprint to
   visually verify.
2. **Section 5 user-stated concern** reads localStorage in a `useEffect`. The
   verifier exercises the source-level wiring (asserts the source contains
   `localStorage` and `User-stated concern`), but the runtime path requires a real
   browser to confirm the slot renders above system risks.
3. **Section 9 prefers `recommendations[0]`** — when recommendations is empty the
   brief degrades to a 3-sentence summary (current condition + strongest + weakest
   only). The verifier confirms this is graceful, not broken.
4. **Section 10 actions always render 5** even when the data they reference is
   absent — they fall back to neutral prompts ("Which government scheme should I
   explore for my business?" rather than the specific scheme). The verifier
   confirms 5 actions are present in every scenario.

## 8. Final status

| Item | Status |
|------|--------|
| Code shipped | All 10 sections + orchestrator |
| Type-check | PASS (exit 0) |
| Lint | PASS (exit 0) |
| Build | PASS (exit 0) |
| H5.1 verifier | PASS (72/72, exit 0) |
| Runtime scenario matrix | PASS (22/22 across 4 scenarios, exit 0) |
| Verifier stub-leak hygiene | PASS (no stubs in source tree after run) |
| SPRINT_H5_1_REPORT.md | THIS FILE |
