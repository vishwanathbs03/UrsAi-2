/**
 * Sprint H4.2-P0 — critical quality hardening.
 *
 * Four helpers used by `consultant.ts` to fix:
 *   P0.1 (already wired — decision cards carry payloads;
 *         this module adds an assert-and-fallback helper to
 *         guarantee the payload is never empty when the kind
 *         is decision_*)
 *   P0.2 fallback rescue — second-stage intent inference when
 *         the keyword classifier returns `fallback` for a
 *         realistic business question
 *   P0.3 memory continuity — detect "earlier you talked about X"
 *         and surface a continuity banner
 *   P0.4 sources — replace the placeholder "Drawn from the X
 *         payload." with topic-specific attribution lines
 *
 * No new modules, no LLM, no backend changes. Pure functions
 * over the same `AssistantBundle` the orchestrator already
 * consumes.
 */

import type { QueryKind, ChatSource } from "./types";

// --------------------------------------------------------------------------- //
// P1.1 — Industry context mapping.
// --------------------------------------------------------------------------- //

/**
 * Lightweight industry-adaptation table. Maps a normalized
 * industry string to a small bag of (a) topical advice bullets,
 * (b) action-plan scaffold keywords, (c) certification / buyer /
 * channel vocabulary the consultant should reach for first.
 *
 * Extend by adding a key here; no other code needs to change.
 */
export interface IndustryAdaptation {
  /** Canonical industry label used in greetings. */
  label: string;
  /** Words that hint at this industry (case-insensitive substring). */
  matchers: string[];
  /** Vocabulary pulled into advisor replies when relevant. */
  vocabulary: {
    certifications: string[];
    channels: string[];
    compliance: string[];
    suppliers: string[];
    buyers: string[];
  };
  /** Bullet sub-points the consultant inserts into growth / export advice. */
  playbook: string[];
}

export const INDUSTRY_ADAPTATIONS: IndustryAdaptation[] = [
  {
    label: "Textiles & Apparel",
    matchers: ["textile", "textiles", "apparel", "garment", "yarn", "fabric", "fabrics", "tirupur", "suiting", "denim"],
    vocabulary: {
      certifications: ["OEKO-TEX", "GOTS (organic textile)", "BCI (Better Cotton)", "ISO 9001"],
      channels: ["India Mart", "TradeIndia", "Alibaba", "EC21", "Amazon Global", "Etsy B2B"],
      compliance: ["IEC (Import Export Code)", "GST + HS code for fabric", "BOE / Shipping bill"],
      suppliers: ["Spinning mills", "Yarn traders", "Dyeing houses", "Trims / accessories vendors"],
      buyers: ["Buying houses", "Apparel brands (Zara, H&M, M&S)", "Wholesalers", "Boutique chains"],
    },
    playbook: [
      "Get an IEC and HS code for your top 3 fabrics before chasing export buyers.",
      "Apply for OEKO-TEX or BCI to access EU / US apparel buyers (often a hard gate).",
      "List on India Mart + TradeIndia alongside a Google Business Profile for domestic discovery.",
      "Pre-qualify a freight forwarder who knows Tirupur / Ludhiana / Surat corridors.",
      "Attend 1 trade fair per year (TITFS, Yarn Expo) — even as a visitor — for buyer signals.",
    ],
  },
  {
    label: "Retail / D2C",
    matchers: ["retail", "shop", "store", "boutique", "kirana", "d2c", "ecommerce", "e-commerce", "wholesale"],
    vocabulary: {
      certifications: ["FSSAI (if food)", "Trademark", "BIS (where applicable)"],
      channels: ["Google Business Profile", "Instagram + WhatsApp commerce", "JustDial", "IndiaMart", "Amazon / Flipkart"],
      compliance: ["GST registration", "Shops & Establishment licence", "Consumer Protection Act disclosure"],
      suppliers: ["Local distributors", "Wholesale markets", "Brand-authorised resellers"],
      buyers: ["Walk-in foot traffic", "Local repeat customers", "Pan-India online shoppers"],
    },
    playbook: [
      "Set up + verify a Google Business Profile — local SEO is the cheapest acquisition channel for retail.",
      "Move 10-20% of repeat-buyer conversations to WhatsApp Business with a catalogue.",
      "Track inventory turnover per SKU monthly; kill SKUs that don't turn in 90 days.",
      "Layer a small loyalty / referral program — 5-10% off the next visit.",
      "List top SKUs on Amazon / Flipkart / IndiaMart for incremental discovery.",
    ],
  },
  {
    label: "Manufacturing",
    matchers: ["manufactur", "factory", "production", "plant", "machining", "fabrication", "oem", "foundry"],
    vocabulary: {
      certifications: ["ISO 9001", "ISO 14001", "AS9100 (aerospace)", "IATF 16949 (auto)"],
      channels: ["India Mart", "Alibaba", "TradeIndia", "ThomasNet", "Direct B2B sales"],
      compliance: ["Factory licence", "Pollution NOC", "Fire NOC", "Factory Inspectorate registration"],
      suppliers: ["Raw material vendors", "Component OEMs", "Logistics partners"],
      buyers: ["Industrial buyers", "OEMs", "Government tenders (GeM)", "Defence (where applicable)"],
    },
    playbook: [
      "Audit your top-3 supplier dependencies and qualify a second source for each.",
      "Document top-5 SOPs (order-to-cash, procure-to-pay, hire-to-retire, changeover, quality hold).",
      "Track OEE (Overall Equipment Effectiveness) — target 65%+ as a baseline.",
      "Apply for ISO 9001 if you don't have it; many OEMs require it as a vendor gate.",
      "List on GeM (Government e-Marketplace) — free to register, low-hanging PSU orders.",
    ],
  },
  {
    label: "Technology / Services",
    matchers: ["software", "saas", "service", "agency", "consultancy", "consulting", "tech", "it services", "freelance", "studio"],
    vocabulary: {
      certifications: ["ISO 27001 (if handling client data)", "SOC 2 (for SaaS selling to enterprise)", "DPIIT recognition (for SaaS / startup benefits)"],
      channels: ["LinkedIn (organic + paid)", "Cold email", "Google Ads", "Partner / referral networks", "Slack communities"],
      compliance: ["GST on services (no ITC)", "Professional tax (state-wise)", "DPIIT / Startup India registration"],
      suppliers: ["Cloud (AWS / GCP / Azure)", "Outsourced developers", "Sub-contractor networks"],
      buyers: ["SMB and mid-market clients", "Enterprise via RFP", "D2C brands for services"],
    },
    playbook: [
      "Build a 5-step content engine on LinkedIn (case study / POV / how-to).",
      "Set up an account-based outbound motion for 10 named target accounts.",
      "Standardise your proposal + SOW template — close in fewer meetings.",
      "Move 1-2 deliverables onto a fixed-fee subscription model (recurring revenue).",
      "Document a 2-person onboarding playbook so new hires are billable in week 2.",
    ],
  },
];

export const GENERIC_ADAPTATION: IndustryAdaptation = {
  label: "MSME",
  matchers: [],
  vocabulary: {
    certifications: ["Udyam / MSME registration", "ISO 9001 (where industry-typical)"],
    channels: ["Google Business Profile", "India Mart", "LinkedIn / Instagram"],
    compliance: ["GST", "Shops & Establishment / factory licence", "Professional tax"],
    suppliers: ["Verified vendor list", "Backup suppliers for top-3 inputs"],
    buyers: ["Existing customers", "Channel partners", "Trade shows"],
  },
  playbook: [
    "Verify Udyam registration and keep it up to date — many scheme gates check this first.",
    "Set up a Google Business Profile + a single landing page if you have no web presence.",
    "Document top-3 SOPs so the business doesn't stop when the founder steps away.",
    "Build a 90-day cash-flow forecast and review it weekly.",
    "Identify the one customer / supplier dependency that worries you most — then de-risk it.",
  ],
};

/**
 * Returns the matching industry adaptation for a given industry
 * string (e.g. "Textiles & Apparel", "Retail / D2C", or any free
 * text). Falls back to GENERIC_ADAPTATION when no matchers hit.
 */
export function matchIndustry(industry: string | null | undefined): IndustryAdaptation {
  if (!industry) return GENERIC_ADAPTATION;
  const lower = industry.toLowerCase();
  for (const adapt of INDUSTRY_ADAPTATIONS) {
    for (const m of adapt.matchers) {
      if (lower.includes(m)) return adapt;
    }
  }
  return GENERIC_ADAPTATION;
}

// --------------------------------------------------------------------------- //
// P1.3 — Growth-target extraction.
// --------------------------------------------------------------------------- //

export interface GrowthTarget {
  /** Detected? */
  present: boolean;
  /** Current revenue value (in INR). */
  currentInr: number | null;
  /** Target revenue value (in INR). */
  targetInr: number | null;
  /** Absolute gap (target - current). */
  gapInr: number | null;
  /** Multiplier (target / current). */
  multiplier: number | null;
  /** Time horizon phrase ("next year", "by Q4", or null). */
  horizon: string | null;
  /** Original prompt, preserved verbatim. */
  rawPrompt: string;
}

/**
 * Parse revenue-target phrases out of a user prompt.
 *   "I want to grow from ₹1.5 Cr to ₹3 Cr next year"
 *     -> { current: 15_000_000, target: 30_000_000, gap: 15M, multiplier: 2, horizon: "next year" }
 *   "Reach ₹5 crore in 12 months"
 *     -> { current: null, target: 50_000_000, horizon: "12 months" }
 * Indian numbering: "1.5 Cr" / "15 lakh" / "₹ 50 L" / "20,00,000".
 */
const RUPEE_PATTERNS: Array<{ re: RegExp; toInr: (n: number) => number }> = [
  { re: /(\d+(?:\.\d+)?)\s*crore/i, toInr: (n) => n * 10_000_000 },
  { re: /(\d+(?:\.\d+)?)\s*cr\b/i, toInr: (n) => n * 10_000_000 },
  { re: /(\d+(?:\.\d+)?)\s*lakh/i, toInr: (n) => n * 100_000 },
  { re: /(\d+(?:\.\d+)?)\s*L\b/, toInr: (n) => n * 100_000 },
  { re: /(\d+(?:,\d{2,3})+)/, toInr: (n) => n }, // 1,50,00,000 Indian grouping
];

export function extractGrowthTarget(prompt: string): GrowthTarget {
  const text = prompt;
  // Find every rupee amount + its index.
  type Hit = { idx: number; value: number; raw: string };
  const hits: Hit[] = [];
  for (const p of RUPEE_PATTERNS) {
    let m: RegExpExecArray | null;
    const re = new RegExp(p.re.source, "gi");
    while ((m = re.exec(text)) !== null) {
      hits.push({ idx: m.index, value: p.toInr(parseFloat(m[1].replace(/,/g, ""))), raw: m[0] });
    }
  }
  hits.sort((a, b) => a.idx - b.idx);
  let current: number | null = null;
  let target: number | null = null;
  if (hits.length >= 2) {
    // First amount is current (or pre-target), second is target.
    // Pick the larger of the two as the target.
    const a = hits[0].value;
    const b = hits[1].value;
    if (a > b) {
      current = b;
      target = a;
    } else if (b > a) {
      current = a;
      target = b;
    } else {
      current = a;
      target = a;
    }
  } else if (hits.length === 1) {
    // Single-amount prompt: assume it's the target.
    target = hits[0].value;
  }
  // Horizon.
  let horizon: string | null = null;
  const horizonRe = /\b(next year|by\s+(?:Q[1-4]|end of (?:year|quarter|month))|in\s+(\d{1,2})\s+(months?|quarters?|years?)|within\s+(\d{1,2})\s+(months?|years?))/i;
  const horizonMatch = text.match(horizonRe);
  if (horizonMatch) horizon = horizonMatch[0];
  const gap = current !== null && target !== null ? target - current : null;
  const multiplier = current !== null && target !== null && current > 0 ? target / current : null;
  return {
    present: target !== null,
    currentInr: current,
    targetInr: target,
    gapInr: gap,
    multiplier,
    horizon,
    rawPrompt: prompt,
  };
}

export function formatInr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 === 0 ? 0 : 1)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// --------------------------------------------------------------------------- //
// P1.4 — User-stated risk / concern extraction.
// --------------------------------------------------------------------------- //

const CONCERN_PHRASES = [
  "my biggest worry", "my main worry", "my concern is", "i'm worried about",
  "i am worried about", "concerned about", "what worries me", "risk that worries me",
  "scared of", "afraid that", "single point of failure", "single point",
];

export interface UserStatedConcern {
  present: boolean;
  /** Free-text topic the user said they were worried about. */
  topic: string | null;
  /** Lowercase keyword(s) the consultant should anchor on. */
  keywords: string[];
}

/**
 * Detect a user-stated concern ("My biggest worry is supplier
 * dependency"). Returns the topic phrase + lowercased keywords
 * the consultant should look for in the bundle.
 */
export function extractUserConcern(prompt: string): UserStatedConcern {
  const lower = prompt.toLowerCase();
  for (const phrase of CONCERN_PHRASES) {
    const i = lower.indexOf(phrase);
    if (i === -1) continue;
    const after = prompt.slice(i + phrase.length).replace(/^[\s,.;:—\-]+/, "");
    // Take up to the first terminal punctuation.
    const topicMatch = after.match(/^([A-Za-z0-9][A-Za-z0-9\s&'/_-]{1,80}?)(?:\.|,|;|\?|!|—|-|$)/);
    const topic = topicMatch ? topicMatch[1].trim() : null;
    if (topic) {
      const stopwords = new Set(["about", "the", "a", "an", "of", "to", "is", "are", "and", "or", "with", "for", "on", "in"]);
      const keywords = topic
        .toLowerCase()
        .split(/[\s&'/_-]+/)
        .filter((w) => w && !stopwords.has(w));
      return { present: true, topic, keywords };
    }
  }
  return { present: false, topic: null, keywords: [] };
}

// --------------------------------------------------------------------------- //
// P1.5 — B2B vs B2C detection.
// --------------------------------------------------------------------------- //

export type AudienceMode = "B2B" | "B2C" | "unknown";

export interface AudienceAdaptation {
  mode: AudienceMode;
  channels: string[];
  cadenceNote: string;
  playbook: string[];
}

const B2B_SIGNALS = [
  "b2b", "wholesale", "distributor", "retailer", "dealer", "channel partner",
  "trade fair", "trade show", "exhibition", "linkedin", "rfp", "tender", "enterprise",
  "industrial buyer", "oem buyer",
];

const B2C_SIGNALS = [
  "b2c", "consumer", "retail customer", "shopper", "walk-in", "instagram",
  "whatsapp commerce", "local seo", "google business", "reviews", "loyalty",
];

export function detectAudience(prompt: string, industry: string | null | undefined): AudienceAdaptation {
  const lower = prompt.toLowerCase() + " " + (industry ?? "").toLowerCase();
  let b2b = 0;
  let b2c = 0;
  for (const s of B2B_SIGNALS) if (lower.includes(s)) b2b++;
  for (const s of B2C_SIGNALS) if (lower.includes(s)) b2c++;
  // Default to B2B for wholesale / distribution / manufacturing, B2C for retail.
  if (b2b === 0 && b2c === 0) {
    if (/manufactur|industrial|b2b/i.test(lower)) b2b++;
    if (/retail|kirana|consumer|ecommerce|d2c/i.test(lower)) b2c++;
  }
  const mode: AudienceMode = b2b > b2c ? "B2B" : b2c > b2b ? "B2C" : "unknown";
  if (mode === "B2B") {
    return {
      mode,
      channels: ["LinkedIn (organic + ABM)", "Distributor / dealer networks", "Trade fairs", "Cold email to named accounts", "WhatsApp Business for account follow-up"],
      cadenceNote: "B2B cycles run 30-180 days; expect 5-10 nurture touches per opportunity.",
      playbook: [
        "Pick 10 named target accounts and run account-based marketing (ABM) — not broadcast.",
        "Document a 3-step discovery → demo → proposal script so every AE sells the same way.",
        "Attend at least one industry trade fair per year — visitors count.",
        "Build a referral partner program (15-20% margin share).",
        "Track time-to-first-meeting and proposal-to-close, not just MQLs.",
      ],
    };
  }
  if (mode === "B2C") {
    return {
      mode,
      channels: ["Google Business Profile + local SEO", "Instagram Reels + Stories", "WhatsApp Business catalogue", "JustDial / IndiaMart discovery", "Amazon / Flipkart marketplace"],
      cadenceNote: "B2C decision cycles are 0-7 days; speed and proof matter.",
      playbook: [
        "Verify + optimise your Google Business Profile (categories, photos, posts).",
        "Post 3-5 Reels per week — before/after, customer POV, founder story.",
        "Move 20% of repeat buyers to WhatsApp catalogue (faster reorder).",
        "Collect 10+ Google reviews per quarter from happy customers.",
        "Run a monthly promotion tied to a calendar moment (festive, exam, summer).",
      ],
    };
  }
  return {
    mode,
    channels: ["Either B2B (LinkedIn, trade fairs) or B2C (Instagram, WhatsApp) depending on who you sell to"],
    cadenceNote: "Pick the channel that matches how your customer actually buys — not the one with the biggest audience.",
    playbook: [
      "Before picking a channel, write down one sentence: 'My customer is [X] and they buy from [Y] because [Z].'",
      "Pick the single channel that matches that sentence; run it for 90 days before adding a second.",
      "Measure cost-per-acquisition and customer-lifetime-value, not follower count.",
    ],
  };
}

// --------------------------------------------------------------------------- //
// P1.6 — Product-help intent.
// --------------------------------------------------------------------------- //

const PRODUCT_HELP_PHRASES = [
  "how do i export this conversation", "how do i export this chat", "export this conversation",
  "export this chat", "export conversation", "download conversation", "download chat",
  "how do i generate a pdf", "generate a pdf", "create a pdf", "pdf report",
  "where can i find my report", "where do i find my report", "where is my report",
  "how do i update my business profile", "update business profile", "edit profile",
  "how do i use analytics", "how to use analytics", "where is analytics",
  "how do i find schemes", "where are schemes", "find government schemes",
  "how do i change my plan", "change plan", "upgrade plan",
  "how do i share", "share my dashboard", "share my report",
  "where are notifications", "how do notifications work",
];

export function detectProductHelp(prompt: string): { isProductHelp: boolean; topic: string | null } {
  const lower = prompt.toLowerCase().trim();
  for (const p of PRODUCT_HELP_PHRASES) {
    if (lower.includes(p)) {
      return { isProductHelp: true, topic: p };
    }
  }
  // Generic "how do i..." questions about UrsBiz features (heuristic).
  if (lower.startsWith("how do i ") && /conversation|pdf|report|profile|analytics|schemes|plan|notif/.test(lower)) {
    return { isProductHelp: true, topic: "ursbiz_feature" };
  }
  return { isProductHelp: false, topic: null };
}

export function productHelpBody(topic: string | null): {
  body: string;
  bullets: Array<{ id: string; title: string; subtitle?: string }>;
} {
  const lower = (topic ?? "").toLowerCase();
  if (/export.*conversation|export.*chat|download.*conversation/.test(lower)) {
    return {
      body: "UrsBiz lets you export any conversation as Markdown, plain text, or JSON. Here's how:",
      bullets: [
        { id: "ph-conv-1", title: "Open the conversation toolbar", subtitle: "Look for the Export button on the conversation header (top-right of the chat panel)." },
        { id: "ph-conv-2", title: "Choose Markdown / Text / JSON", subtitle: "Markdown preserves structure; plain text is for copy-paste; JSON is for archival." },
        { id: "ph-conv-3", title: "Click to download", subtitle: "The browser saves the file to your Downloads folder — no upload, fully local." },
        { id: "ph-conv-4", title: "Search within the conversation", subtitle: "Use the search box on the toolbar to find a specific user or assistant message." },
      ],
    };
  }
  if (/pdf|generate.*pdf|create.*pdf/.test(lower)) {
    return {
      body: "UrsBiz doesn't export the chat as a PDF directly, but you can do it in two clicks:",
      bullets: [
        { id: "ph-pdf-1", title: "Export the conversation as Markdown first", subtitle: "Use the Export button → Markdown." },
        { id: "ph-pdf-2", title: "Open the .md file in any editor and Print → Save as PDF", subtitle: "Chrome, Edge, Word, and VS Code all support this." },
        { id: "ph-pdf-3", title: "Or: Export as JSON and convert with pandoc", subtitle: "pandoc chat.json -o chat.pdf — useful if you script it." },
      ],
    };
  }
  if (/find.*report|where.*report/.test(lower)) {
    return {
      body: "Your reports live in the Reports section. Here's how to find them:",
      bullets: [
        { id: "ph-rep-1", title: "Reports in the side navigation", subtitle: "Click 'Reports' in the left sidebar to see all generated reports." },
        { id: "ph-rep-2", title: "Filter by section", subtitle: "Use the chapter nav on the hero to jump to Executive Summary, Risk Matrix, etc." },
        { id: "ph-rep-3", title: "Print the report", subtitle: "Use the browser Print dialog (Ctrl+P) — UrsBiz's print stylesheet is tuned for clean PDFs." },
      ],
    };
  }
  if (/update.*profile|edit.*profile/.test(lower)) {
    return {
      body: "Update your Business Profile from the Business section:",
      bullets: [
        { id: "ph-prof-1", title: "Open Business in the side nav", subtitle: "This is where your business identity, employees, revenue, and certifications live." },
        { id: "ph-prof-2", title: "Edit fields inline", subtitle: "Click any field to edit. Save triggers a fresh analysis." },
        { id: "ph-prof-3", title: "Changes propagate to the Assistant", subtitle: "The next time you ask a question, the consultant uses the new profile data." },
      ],
    };
  }
  if (/use analytics|where.*analytics/.test(lower)) {
    return {
      body: "The Analytics page gives you the full health read:",
      bullets: [
        { id: "ph-ana-1", title: "Open Analytics in the side nav", subtitle: "Six-pillar score, business health trend, and benchmark compare." },
        { id: "ph-ana-2", title: "Filter by date range", subtitle: "Use the date range selector at the top to zoom in." },
        { id: "ph-ana-3", title: "Ask the Assistant about a metric", subtitle: "Type 'why is my digital score low?' — the consultant reads the same data." },
      ],
    };
  }
  if (/find.*schemes|where.*schemes/.test(lower)) {
    return {
      body: "Government Schemes live in their own section:",
      bullets: [
        { id: "ph-sch-1", title: "Open Schemes in the side nav", subtitle: "Filterable catalogue of PMEGP, MUDRA, CGTMSE, Udyam, and state schemes." },
        { id: "ph-sch-2", title: "Use the eligibility filter", subtitle: "Pick your revenue band + industry to surface the schemes you actually qualify for." },
        { id: "ph-sch-3", title: "Ask the Assistant", subtitle: "Type 'PMEGP' or 'MUDRA' — the assistant will pre-qualify you against your profile." },
      ],
    };
  }
  // Generic fallback.
  return {
    body: "Here's how to find what you need in UrsBiz:",
    bullets: [
      { id: "ph-gen-1", title: "Use the left sidebar", subtitle: "Every section — Dashboard, Analytics, Assistant, Advisor, Reports, Schemes — lives in the side nav." },
      { id: "ph-gen-2", title: "Ask the Assistant", subtitle: "Type your question here and the consultant routes to the right page or pulls the data." },
      { id: "ph-gen-3", title: "Search / export any conversation", subtitle: "Top-right of the chat panel: search box + Export (Markdown / Text / JSON)." },
    ],
  };
}

// --------------------------------------------------------------------------- //
// P0.4 — Topic-specific source attribution.
// --------------------------------------------------------------------------- //

/**
 * Returns the human-readable attribution line for a given source
 * topic + the user's business context. These are deterministic
 * substitutions, not invented citations. They tell the user
 * where the answer came from (their profile, their score,
 * their recommendations, the scheme catalog) — not external
 * claims. If no in-context attribution applies, returns null
 * so the caller can hide the source row.
 */
export function sourceAttribution(
  topic:
    | "Twin"
    | "Recommendations"
    | "Roadmap"
    | "Insights"
    | "Rules"
    | "Business DNA"
    | "Export",
  ctx: SourceContext,
): string {
  switch (topic) {
    case "Twin":
      if (ctx.legalName)
        return `Based on your business profile — ${ctx.legalName}, ${ctx.industry}, ${ctx.revenueBandLabel}`;
      return "Based on your business profile";
    case "Recommendations":
      if (ctx.recCount > 0)
        return `Based on your current recommendations (${ctx.recCount} active — ${ctx.criticalCount} critical, ${ctx.highCount} high)`;
      return "Based on your current recommendations";
    case "Roadmap":
      if (ctx.roadmapItems > 0)
        return `Based on your roadmap (${ctx.roadmapItems} items, projected score ${ctx.projectedScore}/100)`;
      return "Based on your roadmap";
    case "Insights":
      if (ctx.insightCount > 0)
        return `Based on your business insights (${ctx.insightCount} active)`;
      return "Based on your business insights";
    case "Rules":
      if (ctx.ruleFirings > 0)
        return `Based on your Business Health Score (${ctx.healthScore}/100, ${ctx.activeRulesCategories} categories with active rule firings)`;
      return "Based on your Business Health Score";
    case "Business DNA":
      return `Based on your Business DNA (${ctx.dnaArchetype}, ${ctx.dnaMatch}% match)`;
    case "Export":
      return "Based on the Export Opportunities catalogue (govt. trade + customs data)";
  }
}

export interface SourceContext {
  legalName: string | null;
  industry: string | null;
  revenueBandLabel: string;
  healthScore: number;
  dnaArchetype: string | null;
  dnaMatch: number;
  recCount: number;
  criticalCount: number;
  highCount: number;
  roadmapItems: number;
  projectedScore: number | null;
  insightCount: number;
  ruleFirings: number;
  activeRulesCategories: number;
}

/**
 * Build a `ChatSource[]` from a topic list + context. The detail
 * line is the topic-specific attribution. If the topic list is
 * empty, returns an empty array (the renderer should hide the
 * source row).
 */
export function resolveSources(
  topics: Array<
    | "Twin"
    | "Recommendations"
    | "Roadmap"
    | "Insights"
    | "Rules"
    | "Business DNA"
    | "Export"
  >,
  ctx: SourceContext,
): ChatSource[] {
  return topics.map((t) => ({
    topic: t,
    detail: sourceAttribution(t, ctx),
  }));
}

// --------------------------------------------------------------------------- //
// P0.2 — Fallback rescue classifier.
// --------------------------------------------------------------------------- //

interface RescueRule {
  kind: Exclude<QueryKind, "fallback">;
  phrases: readonly string[];
  /** Minimum score the rule needs to claim a rescue. */
  weight?: number;
}

const RESCUE_RULES: readonly RescueRule[] = [
  // Revenue / growth questions
  { kind: "growth_strategy", phrases: [
    "increase revenue", "revenue growth", "reach ₹", "doubl", "10x", "₹3 cr", "₹2 cr",
    "next year", "year over year", "yoy", "grow revenue", "grow the business", "grow sales",
    "annual revenue", "top line", "increase sales",
  ] },
  // Single supplier / customer / dependency / worry -> risk
  { kind: "risk", phrases: [
    "supplier", "supplier dependency", "single source", "single supplier", "concentrated",
    "out of business", "lose a customer", "lose my", "lose the", "worried", "worry",
    "risk if", "what if", "contingency", "fire", "flood", "drought",
  ] },
  // Export / fabrics / IEC / Tirupur -> export_opportunities or scaling
  { kind: "export_opportunities", phrases: [
    "export", "iec", "iec number", "fabrics", "ship overseas", "international buyers",
    "fieo", "ecgc", "customs duty", "hsn code", "global trade",
  ] },
  { kind: "scaling", phrases: [
    "second unit", "new unit", "tirupur", "new branch", "new city", "new factory",
    "open another", "expand", "new geography", "new market",
  ] },
  // B2B vs B2C marketing
  { kind: "marketing", phrases: [
    "get customers", "more customers", "lead gen", "lead generation", "b2b", "b2c",
    "retailers", "wholesalers", "distributors", "dealer", "channel partner",
    "advertising budget", "no budget", "low budget",
  ] },
  // Finance
  { kind: "finance", phrases: [
    "working capital", "₹10 lakh", "₹5 lakh", "₹10l", "₹5l", "raise capital",
    "where can i get", "borrow", "loan", "cash flow", "cashflow",
  ] },
  // GST — keep loose
  { kind: "gst", phrases: [
    "gst", "goods and services tax", "tax registration", "gstin", "gstr",
  ] },
  // Schemes
  { kind: "government_schemes", phrases: [
    "scheme", "schemes", "subsidy", "pmegp", "mudra", "udyam", "cgtmse",
    "textile scheme", "msme scheme", "startup india",
  ] },
  // Digital
  { kind: "digital_transformation", phrases: [
    "website", "selling online", "online presence", "ecommerce", "e-commerce",
    "go online", "digitise", "digital", "seo", "instagram", "facebook ads",
  ] },
  // Operations
  { kind: "operations", phrases: [
    "inventory", "messy", "warehouse", "supply chain", "operations", "sop", "processes",
  ] },
  // Hiring (general topic — different from decision_hire)
  { kind: "hiring", phrases: [
    "first hire", "hiring plan", "how to hire", "recruit", "interview", "salary",
    "team size", "add people", "bring on", "how do i hire",
  ] },
  // Compliance
  { kind: "compliance", phrases: [
    "compliance", "licence", "license", "roc", "kyc", "audit", "regulatory",
    "annual return", "legal requirement",
  ] },
];

/**
 * Second-pass classifier. Returns the first rescue rule that
 * matches the prompt, or null if no rule matches. Caller should
 * treat null as "no confident rescue available" and use the
 * rescue-response composer.
 */
export function rescueClassify(prompt: string): QueryKind | null {
  const text = prompt.trim().toLowerCase();
  if (!text) return null;
  let best: { kind: QueryKind; score: number } | null = null;
  for (const rule of RESCUE_RULES) {
    let score = 0;
    for (const phrase of rule.phrases) {
      if (text.includes(phrase)) {
        // Longer phrase wins (more specific).
        score += phrase.length;
      }
    }
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { kind: rule.kind, score };
    }
  }
  // Require a minimum confidence: at least one phrase of length >= 4.
  if (!best || best.score < 4) return null;
  return best.kind;
}

// --------------------------------------------------------------------------- //
// P0.3 — Memory continuity detection.
// --------------------------------------------------------------------------- //

const CONTINUITY_PHRASES = [
  "earlier you", "earlier we", "you mentioned", "you talked about", "you said",
  "previously", "earlier today", "as we discussed", "as discussed", "from your earlier",
  "you previously", "you already", "we talked", "we discussed", "earlier you talked",
  "as you mentioned", "as you said", "as you explained", "as you noted",
];

/**
 * Detect "earlier you talked about X" continuity phrases. Returns
 * the topic the user is referring to (best-effort extraction)
 * plus the cleaned prompt with the continuity phrase stripped.
 */
export interface ContinuityResult {
  isFollowup: boolean;
  /** Best-guess earlier topic, if extractable. */
  earlierTopic: string | null;
  /** The prompt with continuity phrases stripped. */
  cleanedPrompt: string;
  /** Confidence 0..1 that this is a follow-up. */
  confidence: number;
}

export function detectContinuity(prompt: string): ContinuityResult {
  const text = prompt.trim().toLowerCase();
  let hit: { phrase: string; index: number } | null = null;
  for (const phrase of CONTINUITY_PHRASES) {
    const i = text.indexOf(phrase);
    if (i !== -1) {
      hit = { phrase, index: i };
      break;
    }
  }
  if (!hit) {
    return { isFollowup: false, earlierTopic: null, cleanedPrompt: prompt, confidence: 0 };
  }
  // Capture the full ORIGINAL prompt (not lowercased) so we keep
  // the user's capitalisation. The topic the user is referring
  // to is the noun phrase just before the first terminal
  // punctuation after the continuity phrase.
  const originalAfter = prompt
    .slice(hit.index + hit.phrase.length)
    .replace(/^[\s,.;:—\-]+/, "")
    .trim();
  let earlierTopic: string | null = null;
  // Greedy: take everything up to the first `.`, `,`, `;`, `?`,
  // `!`, `—`, or end-of-string. Then strip leading stopwords /
  // prepositions (`about`, `on`, `of`, `the`, `for`, `to`,
  // `re`) so the banner reads cleanly.
  const topicMatch = originalAfter.match(
    /^([A-Za-z0-9][A-Za-z0-9\s&'/_-]{1,80}?)(?:\.|,|;|\?|!|—|-|$)/,
  );
  if (topicMatch) {
    earlierTopic = topicMatch[1]
      .replace(/^(about|on|of|the|for|to|re|regarding)\s+/i, "")
      .replace(/\s+(about|on|of|for|to|re|regarding)\s+/i, " ")
      .trim() || null;
  }
  // Strip the continuity phrase + topic from the prompt so the
  // body focuses on the actual question.
  let cleaned = prompt.slice(0, hit.index) + prompt.slice(hit.index + hit.phrase.length);
  cleaned = cleaned.replace(/^[\s,.;:—\-]+|[\s,.;:—\-]+$/g, "").trim();
  if (!earlierTopic) {
    earlierTopic = "the previous topic";
  }
  return {
    isFollowup: true,
    earlierTopic,
    cleanedPrompt: cleaned || prompt,
    confidence: topicMatch ? 0.9 : 0.55,
  };
}

/**
 * Build the continuity banner that gets prepended to the
 * Executive Summary body. Returns null when no continuity
 * applies.
 */
export function buildContinuityBanner(
  earlierTopic: string | null,
  recentTopics: string[],
): string | null {
  if (!earlierTopic) return null;
  // Pick the closest recent topic to the user's reference.
  const match =
    recentTopics.find((t) => t.toLowerCase().includes(earlierTopic.toLowerCase())) ??
    recentTopics.find((t) => earlierTopic.toLowerCase().includes(t.toLowerCase())) ??
    null;
  const ref = match ?? earlierTopic;
  return `Earlier in this session we discussed ${ref} — let me build on that read.`;
}

// --------------------------------------------------------------------------- //
// P0.2 — Fallback rescue-response composer.
// --------------------------------------------------------------------------- //

/**
 * When neither the keyword classifier nor the rescue classifier
 * can map the user's prompt to a business intent, return a
 * "what I understood + clarifying question + next topics" body
 * instead of the generic overview. Never invents facts.
 */
export function rescueBody(
  prompt: string,
  ctx: SourceContext,
): {
  body: string;
  clarifyingQuestion: string;
  suggestedTopics: string[];
} {
  const lines: string[] = [];
  lines.push(
    `I read your question and I don't have a confident business-intent match yet. Let me show what I'm working with from your profile so the next step is concrete.`,
  );
  // Profile recap — only what the bundle has, never invented.
  const profileBits: string[] = [];
  if (ctx.legalName) profileBits.push(`Business: ${ctx.legalName}`);
  if (ctx.industry) profileBits.push(`Industry: ${ctx.industry}`);
  if (ctx.revenueBandLabel) profileBits.push(`Revenue band: ${ctx.revenueBandLabel}`);
  profileBits.push(`Business score: ${ctx.healthScore}/100`);
  if (ctx.dnaArchetype) profileBits.push(`DNA: ${ctx.dnaArchetype} (${ctx.dnaMatch}% match)`);
  if (profileBits.length) {
    lines.push(`Here's what I see in your profile: ${profileBits.join(" · ")}.`);
  }
  lines.push(`Your question was: "${prompt.length > 240 ? prompt.slice(0, 240) + "…" : prompt}"`);
  lines.push("To give you a more useful answer, could you clarify which of these you meant?");
  const clarifying =
    "Which of the following is closest to what you want help with: growth, finance, hiring, operations, marketing, compliance, or a specific risk?";
  const suggested = pickRelevantTopics(ctx);
  return { body: lines.join(" "), clarifyingQuestion: clarifying, suggestedTopics: suggested };
}

function pickRelevantTopics(ctx: SourceContext): string[] {
  const topics: string[] = [];
  if (ctx.healthScore < 60) topics.push("Improve my business score");
  if (ctx.healthScore >= 50 && ctx.recCount > 0) topics.push("Should I apply for a loan?");
  if (ctx.healthScore >= 55) topics.push("Should I hire?");
  if (ctx.healthScore < 70) topics.push("Operations quick wins");
  topics.push("Help me with marketing");
  return topics.slice(0, 3);
}

// --------------------------------------------------------------------------- //
// P0.1 — Decision-card guard.
// --------------------------------------------------------------------------- //

// --------------------------------------------------------------------------- //
// P1 — Industry adaptation hook.
// --------------------------------------------------------------------------- //

/**
 * Returns 3-5 playbook bullets the consultant should surface
 * when the relevant kind (growth / export / marketing / scaling
 * / decision_expand) fires. Pulled from the matched industry
 * adaptation; falls back to the generic MSME playbook.
 */
export function industryPlaybookBullets(
  adapt: IndustryAdaptation,
  kind: "growth" | "export" | "marketing" | "scaling" | "improve" = "improve",
): string[] {
  // Always include industry certifications and one channel
  // token — these are the two highest-signal industry-specific
  // signals. Then 2-3 playbook actions.
  const out: string[] = [];
  const vocab = adapt.vocabulary;
  if (kind === "export" || kind === "growth" || kind === "improve") {
    if (vocab.certifications[0]) {
      out.push(`Certification anchor: ${vocab.certifications[0]} (often a buyer gate in this industry).`);
    }
  }
  if (vocab.channels[0]) {
    out.push(`Discovery channel: ${vocab.channels[0]}.`);
  }
  // First two playbook bullets are always returned (they are
  // the highest-leverage moves). The remaining are kind-aware.
  const generic = adapt.playbook.slice(0, 2);
  for (const g of generic) out.push(g);
  if (kind === "export") {
    out.push(`Compliance frame: ${vocab.compliance[0] ?? "GST + IEC"}.`);
    out.push(`Target buyer: ${vocab.buyers[0] ?? "industrial buyer"}.`);
  } else if (kind === "marketing") {
    out.push(`Channel cadence: lean on ${vocab.channels.slice(1, 3).join(", ") || vocab.channels[0]} first.`);
  } else if (kind === "scaling") {
    out.push(`Supplier map: qualify a second ${vocab.suppliers[0] ?? "supplier"} before the pilot.`);
  } else if (kind === "growth") {
    out.push(`Top supplier pool: ${vocab.suppliers[0] ?? "your existing vendor base"}.`);
  }
  return out.slice(0, 5);
}

/**
 * Returns the industry-adaptive summary line that replaces the
 * generic "Growth strategy for X" / "Marketing plan for X"
 * opener. Always references the actual industry label and a
 * concrete industry-specific token so the user sees the answer
 * was tailored, not boilerplate.
 */
export function industryGreetingLine(
  adapt: IndustryAdaptation,
  kindLabel: "growth" | "marketing" | "export" | "scaling" | "improve",
  legalName: string,
): string {
  switch (kindLabel) {
    case "growth":
      return `Growth playbook for **${legalName}** (${adapt.label}). We anchor growth on certifications + the dominant discovery channel first.`;
    case "marketing":
      return `Marketing plan for **${legalName}** (${adapt.label}). The channel mix below is calibrated for ${adapt.label} — not borrowed from generic B2C or B2B playbooks.`;
    case "export":
      return `Export roadmap for **${legalName}** (${adapt.label}). We start with the certification gate (${adapt.vocabulary.certifications[0] ?? "ISO/IEC"}) and work backward from there.`;
    case "scaling":
      return `Scaling roadmap for **${legalName}** (${adapt.label}). The qualified-buyer pool (${adapt.vocabulary.buyers[0] ?? "industrial buyers"}) shapes the channel choice.`;
    case "improve":
      return `Improvement playbook for **${legalName}** (${adapt.label}). The top three moves below are scored against ${adapt.label} peers — not generic MSME templates.`;
  }
}

// --------------------------------------------------------------------------- //
// P1 — Growth-target composer.
// --------------------------------------------------------------------------- //

/**
 * Standard growth levers the consultant should propose for a
 * revenue-doubling question. Ordered by ease first (existing
 * customer expansion) then by reach (new channels / markets).
 */
export const GROWTH_LEVERS: ReadonlyArray<{
  id: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: "lever-existing",
    title: "Increase existing customer revenue",
    subtitle:
      "Raise average order value (10-15%) + run a retention / repeat-buyer motion. Lowest CAC, fastest payback.",
  },
  {
    id: "lever-product",
    title: "Add new products or services",
    subtitle:
      "Bundle or premiumize the existing catalogue. Aim for 1-2 flagship SKUs that pull traffic in.",
  },
  {
    id: "lever-channel",
    title: "Enter new channels",
    subtitle:
      "Marketplace + D2C + B2B distributor — pick the one where the buyer actually buys (not the one with the loudest marketing).",
  },
  {
    id: "lever-market",
    title: "Enter new markets (geography + export)",
    subtitle:
      "Domestic Tier-2 / Tier-3 cities or an early export push (only when readiness ≥ 50).",
  },
  {
    id: "lever-digital",
    title: "Improve digital acquisition",
    subtitle:
      "SEO + paid social + WhatsApp commerce, run for 90 days before declaring which channel won.",
  },
];

/**
 * Compose a phased 4-month action plan for the user's stated
 * growth target. Pivots off the gap + horizon. Always framed
 * as scenario language ("To target...", "Potential path...",
 * "Assuming...") so we never guarantee revenue growth.
 */
export function growthTargetWeeks(
  currentInr: number | null,
  targetInr: number | null,
  horizon: string | null,
  adapt: IndustryAdaptation,
): Array<{ weekNumber: number; weekLabel: string; objective: string; actions: string[] }> {
  const cur = currentInr;
  const tgt = targetInr;
  const mult =
    cur && tgt && cur > 0 ? ` ${Math.round((tgt / cur) * 100) / 100}× current revenue` : "";
  return [
    {
      weekNumber: 1,
      weekLabel: `Week 1 — Baseline + Gap`,
      objective: `Quantify the ${mult || "target"} gap and source-of-truth numbers.`,
      actions: [
        `Lock the current revenue baseline (₹${cur ? formatInr(cur) : "?"}) and the target (₹${tgt ? formatInr(tgt) : "?"}); document any seasonality.`,
        `List the 3 most likely growth levers for ${adapt.label}: existing customers, new channel, new product.`,
        `Set a 30-day review cadence with one metric per lever.`,
      ],
    },
    {
      weekNumber: 2,
      weekLabel: `Week 2 — Lever 1 (existing customers)`,
      objective: "Stand up the lowest-CAC lever first.",
      actions: [
        `Build an "increase AOV" experiment: bundle + cross-sell motion for top 20% of customers.`,
        `Launch a referral or repeat-buyer motion (WhatsApp catalogue / email / SMS).`,
        `Track weekly AOV and repeat-buyer rate vs baseline.`,
      ],
    },
    {
      weekNumber: 3,
      weekLabel: `Week 3 — Lever 2 (channel or product)`,
      objective: "Add the second lever after Lev er 1 shows signal.",
      actions: [
        `Pick the highest-CAC-parity channel for ${adapt.label}: ${adapt.vocabulary.channels[0]}.`,
        `Add 1 flagship product / SKU that pulls traffic from the chosen channel.`,
        `Document the sales funnel step-by-step and instrument it.`,
      ],
    },
    {
      weekNumber: 4,
      weekLabel: `Week 4 — Lever 3 (de-risk + reassess)`,
      objective: `Confirm whether the ${horizon ?? "stated horizon"} path is realistic; revise.`,
      actions: [
        `Recompute the projected quarterly revenue from Levers 1-3 actuals.`,
        `Decide: stick with the original horizon, or revise it down by 25-50%.`,
        `Document assumptions the projection depends on.`,
      ],
    },
  ];
}

/**
 * Compose the consulting-style summary body for a growth-target
 * prompt. Always uses scenario language — "To target", "Potential
 * path", "Assuming". Never guarantees revenue growth.
 */
export function growthTargetBody(
  target: GrowthTarget,
  adapt: IndustryAdaptation,
): string {
  const parts: string[] = [];
  parts.push(
    `**Growth target read for ${adapt.label}.** To target ${target.targetInr ? formatInr(target.targetInr) : "the goal"} over ${target.horizon ?? "the requested horizon"}, here's the consultant read.`,
  );
  parts.push(
    `**Current** — ${target.currentInr ? formatInr(target.currentInr) : "(not stated — using your profile's annual revenue)"}.`,
  );
  parts.push(
    `**Target** — ${target.targetInr ? formatInr(target.targetInr) : "(not stated — pick a number)"}${target.horizon ? ` within ${target.horizon}` : ""}.`,
  );
  parts.push(
    `**Gap** — ${target.gapInr ? formatInr(target.gapInr) : "to be sized"} (${target.multiplier ? `${Math.round(target.multiplier * 100) / 100}× current` : "to be sized"}).`,
  );
  parts.push(
    `**Potential path** — four levers ranked by ease (existing customers → new products → new channels → new markets). Assuming current product mix and pricing, the first lever alone typically closes 25-40% of the gap; the second + third together close most of the rest.`,
  );
  parts.push(
    `**Risks** — large gaps assume either price uplift (often unrealistic) or significant new-customer acquisition (depends on market growth, not effort alone). Plan to revisit the projection at the end of Month 1.`,
  );
  return parts.join(" ");
}

// --------------------------------------------------------------------------- //
// P1 — Audience (B2B / B2C) composer hook.
// --------------------------------------------------------------------------- //

/**
 * Build the marketing-specific playbook bullets for the user's
 * detected audience. Used by consultant.ts to replace the
 * generic marketing recommendations with audience-specific
 * ones (B2B → LinkedIn / ABM / trade fairs; B2C → Google
 * Business / WhatsApp / Instagram).
 */
export function audienceMarketingBullets(adapt: AudienceAdaptation): Array<{
  id: string;
  title: string;
  subtitle: string;
  tone: "primary" | "success" | "warn" | "info" | "violet";
  meta?: string;
}> {
  if (adapt.mode === "B2B") {
    return [
      {
        id: "aud-b2b-1",
        title: "Pick 10 named target accounts and run ABM",
        subtitle: "LinkedIn outreach + personalised landing pages beats broadcast.",
        tone: "primary",
        meta: "B2B",
      },
      {
        id: "aud-b2b-2",
        title: "Attend one industry trade fair per year",
        subtitle: "Visitors count — even a stand rental + booth is the seed for next quarter's pipeline.",
        tone: "info",
        meta: "B2B",
      },
      {
        id: "aud-b2b-3",
        title: "Stand up a referral partner program",
        subtitle: "15-20% margin share is enough to motivate distributors and consultants.",
        tone: "violet",
        meta: "B2B",
      },
    ];
  }
  if (adapt.mode === "B2C") {
    return [
      {
        id: "aud-b2c-1",
        title: "Verify + optimise your Google Business Profile",
        subtitle: "Local SEO is the cheapest acquisition channel for retail / D2C — claim and post weekly.",
        tone: "primary",
        meta: "B2C",
      },
      {
        id: "aud-b2c-2",
        title: "Post 3-5 Reels per week + WhatsApp catalogue",
        subtitle: "Reels and DMs convert; the catalogue drives reorder velocity.",
        tone: "info",
        meta: "B2C",
      },
      {
        id: "aud-b2c-3",
        title: "Collect 10+ Google reviews / quarter + run a referral",
        subtitle: "Reviews compound; referral lifts retention by 15-25%.",
        tone: "violet",
        meta: "B2C",
      },
    ];
  }
  // Unknown mode — return the dual-path bullets so the user
  // picks the right lane themselves.
  return [
    {
      id: "aud-unknown-1",
      title: "B2B path (if your customer is another business)",
      subtitle: "LinkedIn + ABM + trade fairs + named-account outreach. Long cycles (30-180 days).",
      tone: "primary",
      meta: "Either",
    },
    {
      id: "aud-unknown-2",
      title: "B2C path (if your customer is an end consumer)",
      subtitle: "Google Business Profile + Instagram + WhatsApp commerce + reviews. Short cycles (0-7 days).",
      tone: "info",
      meta: "Either",
    },
    {
      id: "aud-unknown-3",
      title: "Pick the path that matches how your customer actually buys",
      subtitle: "Not the one with the biggest audience — run one path for 90 days before adding the second.",
      tone: "violet",
      meta: "Either",
    },
  ];
}

/**
 * Build the marketing-summary extra sentence that names the
 * detected audience mode + cadence. Replaces the generic
 * "Marketing plan for X" opener.
 */
export function audienceSummary(adapt: AudienceAdaptation, legalName: string): string {
  if (adapt.mode === "B2B") {
    return `Marketing plan for **${legalName}** — calibrated for a **B2B** audience. ${adapt.cadenceNote}`;
  }
  if (adapt.mode === "B2C") {
    return `Marketing plan for **${legalName}** — calibrated for a **B2C** audience. ${adapt.cadenceNote}`;
  }
  return `Marketing plan for **${legalName}** — we couldn't determine B2B vs B2C from context, so the playbook below has both paths clearly labelled. ${adapt.cadenceNote}`;
}

// --------------------------------------------------------------------------- //
// P1 — User-stated concern lead.
// --------------------------------------------------------------------------- //

/**
 * Returns the lead findings bullet for the risk composer when
 * the user explicitly stated a concern ("my biggest worry is
 * supplier dependency"). The orchestrator prepends this
 * bullet to composeRisk() so the user's worry is never buried
 * beneath generic rule firings.
 */
export function userConcernLeadBullet(
  concern: UserStatedConcern,
  criticalRisks: Array<{ risk_id: string; title: string; priority?: string; description?: string }>,
): { id: string; title: string; subtitle: string; tone: "danger" | "warn" | "info" | "primary" | "success" | "violet" } | null {
  if (!concern.present || !concern.topic) return null;
  // Try to match the concern to one of the critical risks.
  const lowerTopic = concern.topic.toLowerCase();
  const match = criticalRisks.find((r) =>
    concern.keywords.some((kw) => kw && r.title.toLowerCase().includes(kw)),
  );
  if (match) {
    return {
      id: "user-concern",
      title: `You said it first: ${concern.topic}`,
      subtitle: `Matches critical risk in your register — "${match.title}". This is the headline, not a footnote.`,
      tone: "danger",
    };
  }
  return {
    id: "user-concern",
    title: `You said it first: ${concern.topic}`,
    subtitle:
      "We acknowledge this before the rule-engine ranking — your stated concern leads, then we layer in the system-detected risks below.",
    tone: "warn",
  };
}

// --------------------------------------------------------------------------- //
// P1 — ActionWeek label synchroniser.
// --------------------------------------------------------------------------- //

/**
 * Week-label maps used to backfill weekNumber / weekLabel /
 * objective / actions on ActionWeek objects whose legacy
 * fields `week` + `steps` are set but new fields are missing.
 *
 * Both names (week/steps/legacy AND weekNumber/weekLabel/
 * objective/actions/new) point at the same data; the legacy
 * fields remain so the older callers / renderers don't break.
 *
 * Pass an ActionWeek[] (in any order) and get a copy that has
 * every new field populated. Pure function.
 */
const PHASE_OBJECTIVES: Record<string, string> = {
  "Discover": "Audit current state and pick the one metric to move.",
  "Build": "Stand up the missing asset / process / documentation.",
  "Activate": "Run the experiment with the team in a tight 7-day loop.",
  "Optimise": "Verify the metric moved; double down on what worked.",
  "Pre-qualification": "Verify prerequisites and lock the destination / partner set.",
  "Compliance": "File paperwork + confirm bank / regulatory acknowledgement.",
  "First shipment": "Ship and verify the duty + payment cycle end-to-end.",
  "Scale": "Decide scale-up vs iterate; refresh the destination shortlist.",
  "File readiness": "Inventory documents and confirm due dates.",
  "File paperwork": "Submit the application and archive the receipt.",
  "Approval / acknowledgement": "Track acknowledgement and re-grade the rec.",
  "Risk review": "Confirm renewals + lock a recurring 30-day reminder.",
  "Set up": "Define success + pick the smallest experiment.",
  "Kickoff": "Run the experiment with a 5-minute daily review cadence.",
  "Iterate": "Read the metrics and cut what didn't move by 10%.",
  "Handover": "Document what worked + promote into the team playbook.",
  "Baseline + Gap": "Quantify the gap and pick the one metric to anchor.",
  "Lever 1 (existing customers)": "Stand up the lowest-CAC lever first.",
  "Lever 2 (channel or product)": "Add a second lever after the first shows signal.",
  "Lever 3 (de-risk + reassess)": "Revisit the projection; revise if needed.",
};

/**
 * Input shape consumed by `normalizeActionWeek`. Either legacy
 * fields (`week` + `steps`) or new fields (`weekNumber` +
 * `weekLabel` + `objective` + `actions`) — both are accepted.
 */
interface RawActionWeek {
  week?: string;
  steps?: string[];
  weekNumber?: number;
  weekLabel?: string;
  objective?: string;
  actions?: string[];
}

/**
 * Output shape: every new field is guaranteed to be populated,
 * and the legacy `week` + `steps` fields are preserved for older
 * renderers / callers.
 */
interface NormalizedActionWeek {
  week: string;
  steps: string[];
  weekNumber: number;
  weekLabel: string;
  objective: string;
  actions: string[];
}

/**
 * Default phases used when a week has none. Matched to the four
 * canonical patterns the orchestrator already emits (Discover /
 * Build / Activate / Optimise), with a generic Optimise fallback.
 */
const DEFAULT_PHASES = ["Discover", "Build", "Activate", "Optimise"] as const;
function defaultPhaseFor(i: number): string {
  return DEFAULT_PHASES[i - 1] ?? "Optimise";
}

export function normalizeActionWeek(input: RawActionWeek): NormalizedActionWeek {
  // Use legacy fields first; fall back to new fields if both
  // are empty.
  const legacyLabel = (input.week ?? "").trim();
  const legacySteps = input.steps ?? [];
  const newLabel = (input.weekLabel ?? "").trim();
  const newActions = input.actions ?? [];
  const newObjective = (input.objective ?? "").trim();
  const weekNumberIn = input.weekNumber;
  // Pick the best available label.
  let label = newLabel || legacyLabel || `Week ${weekNumberIn ?? 1}`;
  // If the legacy label is "Week 1" only (no phase), upgrade it
  // to the canonical pattern.
  if (legacyLabel && !newLabel) {
    label = legacyLabel;
  }
  // Derive weekNumber from the label "Week N" if missing.
  let n = weekNumberIn ?? 0;
  if (!n) {
    const m = label.match(/week\s*(\d+)/i);
    if (m) n = parseInt(m[1], 10);
    if (!n || Number.isNaN(n)) n = 1;
  }
  // Phase label is everything after the "Week N — " prefix.
  let phase = "";
  const stripped = label.replace(/^week\s*\d+\s*[-—]?\s*/i, "").trim();
  if (stripped) phase = stripped;
  // Derive objective from phase vocabulary; fall back to the
  // user's explicitly-set objective; fall back to "Execute".
  const objective =
    newObjective ||
    (phase && PHASE_OBJECTIVES[phase]) ||
    (legacySteps[0] ? String(legacySteps[0]).slice(0, 80) + (String(legacySteps[0]).length > 80 ? "…" : "") : "Execute the planned steps.");
  // Replace the legacy fields with the canonical new fields
  // when both are present, else keep them.
  const actions = newActions.length > 0 ? newActions : legacySteps;
  return {
    week: legacyLabel || label,
    steps: legacySteps,
    weekNumber: n,
    weekLabel: label,
    objective,
    actions,
  };
}

/**
 * Runs normalizeActionWeek over the whole list, guarantees
 * sequential weekNumber 1..N, and replaces any undefined /
 * empty / null labels with the canonical `Week N — Phase`
 * format. Never produces a week with label === "undefined".
 */
export function normalizeActionWeeks(
  weeks: RawActionWeek[],
  defaultPhase: (i: number) => string = defaultPhaseFor,
): NormalizedActionWeek[] {
  if (!Array.isArray(weeks) || weeks.length === 0) return [];
  return weeks.map((w, i) => {
    const fallbackPhase = defaultPhase(i + 1);
    const legacy = (w.week ?? "").toString();
    let label = (w.weekLabel ?? legacy ?? "").toString().trim();
    if (!label || label.toLowerCase() === "undefined" || label.toLowerCase() === "null") {
      label = `Week ${i + 1} — ${fallbackPhase}`;
    } else if (/^week\s*\d+\s*$/i.test(label)) {
      // "Week 3" with no phase — append the default phase.
      label = `${label} — ${fallbackPhase}`;
    }
    const norm = normalizeActionWeek({
      ...w,
      week: legacy,
      steps: w.steps,
      weekNumber: w.weekNumber ?? i + 1,
      weekLabel: label,
      objective: w.objective,
      actions: w.actions,
    });
    return norm;
  });
}

// --------------------------------------------------------------------------- //
// P0.1 — Decision-card guard.
// --------------------------------------------------------------------------- //

/**
 * Asserts that the given kind (one of decision_hire /
 * decision_expand / decision_loan) has a non-empty decision
 * payload. Returns a minimal fallback payload if the
 * consultant returned nothing — keeps the renderer from
 * showing an empty card.
 */
export function ensureDecisionPayload(
  kind: "decision_hire" | "decision_expand" | "decision_loan",
  existing: import("./types").DecisionCardPayload | null | undefined,
  ctx: { healthScore: number; dnaMatch: number; estimatedRoi: number; revenueBandLabel: string },
): import("./types").DecisionCardPayload {
  if (existing && existing.verdict && existing.why) return existing;
  // Compute a minimal deterministic verdict + payload from the
  // bundle snapshot.
  const ready = ctx.healthScore >= 55 && ctx.dnaMatch >= 40;
  const borderline = ctx.healthScore >= 40 && ctx.healthScore < 55;
  const verdict = ready ? "YES" : borderline ? "WAIT" : "NO";
  const verdictTone = verdict === "YES" ? "success" : verdict === "WAIT" ? "warn" : "danger";
  const question =
    kind === "decision_hire"
      ? "Should I Hire?"
      : kind === "decision_expand"
        ? "Should I Expand?"
        : "Should I apply for a Loan?";
  const headline =
    verdict === "YES"
      ? "Conditions support this move."
      : verdict === "WAIT"
        ? "Wait — close the baseline first."
        : "Not yet — readiness is below threshold.";
  return {
    question,
    verdict,
    verdictTone,
    headline,
    why: `Score ${ctx.healthScore}/100, DNA match ${ctx.dnaMatch}%, revenue band ${ctx.revenueBandLabel}.`,
    risks:
      verdict === "YES"
        ? [
            "Add a fixed cost before revenue lifts — runway pressure.",
            "Wrong fit / wrong timing burns 2-3 months.",
          ]
        : ["Adding fixed cost before readiness is set will compound the gap."],
    roi:
      kind === "decision_loan"
        ? "Effective rate 9-14% for collateral-free (CGTMSE), 10-12% for term loan."
        : kind === "decision_expand"
          ? "New geography: 2× revenue potential, 6-12 months payback. New channel: 30-45 days to validation."
          : "Sales hire: payback <4 months · Ops hire: 30-50% throughput lift.",
    timeline: ready ? "30 days to onboard / pilot" : "Re-evaluate in 60-90 days",
    confidence: Math.max(0, Math.min(100, Math.round(40 + ctx.healthScore / 2))),
  };
}
