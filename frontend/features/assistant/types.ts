/**
 * Types for the AI Business Assistant UI (Sprint 7 Part 1).
 *
 * Frontend only. The assistant is a deterministic
 * composer that reads the existing Twin, Recommendations,
 * Roadmap, Rules, and Decision payloads and joins them into
 * a chat-shaped view. There is no LLM call — every response
 * is built locally from fields the upstream payloads already
 * carry.
 *
 * Type families:
 *   - ChatMessage / Conversation        user-facing chat model
 *   - AssistantContext                  the side-panel data
 *   - AssistantResponse                 the deterministic answer
 *   - SuggestedQuestion                 the question chips
 *   - QueryKind                         the intent classifier
 */

// --------------------------------------------------------------------------- //
// Query kind — the deterministic intent classifier picks one of these for
// every user prompt (or suggested-question click). The builder then walks
// the relevant upstream payload and assembles the response.
// --------------------------------------------------------------------------- //

export type QueryKind =
  | "improve_business"
  | "low_score"
  | "what_first"
  | "export_opportunities"
  | "business_dna"
  | "explain_roadmap"
  | "explain_recommendations"
  | "explain_insights"
  | "explain_rules"
  | "general_overview"
  | "growth_strategy"
  | "digital_transformation"
  | "finance"
  | "gst"
  | "government_schemes"
  | "marketing"
  | "operations"
  | "hiring"
  | "compliance"
  | "risk"
  | "scaling"
  | "decision_hire"
  | "decision_expand"
  | "decision_loan"
  | "action_plan"
  | "growth_target"
  | "product_help"
  | "fallback";

// --------------------------------------------------------------------------- //
// Suggested question
// --------------------------------------------------------------------------- //

export interface SuggestedQuestion {
  /** Stable id used as a React key + click handler arg. */
  id: string;
  /** The question shown on the chip. */
  text: string;
  /**
   * The query kind the chip routes to. Lets the chip
   * author pair copy with the deterministic builder
   * that should answer it.
   */
  kind: QueryKind;
}

// --------------------------------------------------------------------------- //
// Chat model
// --------------------------------------------------------------------------- //

export type ChatRole = "user" | "assistant";

export interface ChatSource {
  /** One-word topic the response drew on. */
  topic:
    | "Twin"
    | "Recommendations"
    | "Roadmap"
    | "Insights"
    | "Rules"
    | "Business DNA"
    | "Export";
  /** One-sentence gloss shown when the user expands the source list. */
  detail: string;
}

export interface ChatMessage {
  /** Local id, generated client-side. */
  id: string;
  role: ChatRole;
  /**
   * For user messages: the literal prompt.
   * For assistant messages: the rendered markdown-ish text (plain
   * text with line breaks — the renderer splits on `\n\n` for
   * paragraphs and on `\n- ` for bullet lists).
   */
  content: string;
  /** ISO timestamp captured at message creation. */
  createdAt: string;
  /** Which upstream payloads the assistant drew on, in order. */
  sources?: ChatSource[];
  /** The intent that produced the assistant's answer. */
  kind?: QueryKind;
  /** Sprint H4 — McKinsey-grade structured payload. */
  consultant?: ConsultantResponse;
}

export interface Conversation {
  /** Local id. */
  id: string;
  /** All messages in chronological order. */
  messages: ChatMessage[];
  /** ISO timestamp of the most recent message, or null when empty. */
  lastMessageAt: string | null;
}

// --------------------------------------------------------------------------- //
// Context panel — the data the side panel renders
// --------------------------------------------------------------------------- //

export interface AssistantContextScore {
  /** 0..100 composite from the Twin. */
  value: number;
  /** Human-readable band — "Foundation", "Developing", "Established", "Leading". */
  band: string;
}

export interface AssistantContextDna {
  /** Archetype label (e.g. "The Foundation Builder"). */
  archetype: string;
  /** 0..100 DNA match score. */
  match: number;
}

export interface AssistantContextRecommendations {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AssistantContextRoadmap {
  totalItems: number;
  /** Average completion_percentage across all items, 0..100. */
  avgCompletion: number;
  /** Most-advanced phase actually populated (Immediate / Short-Term / Medium-Term / Long-Term). */
  currentPhase: string;
  /** Total estimated duration string from the roadmap summary. */
  totalDuration: string;
}

export interface AssistantContext {
  score: AssistantContextScore;
  dna: AssistantContextDna;
  recommendations: AssistantContextRecommendations;
  roadmap: AssistantContextRoadmap;
  /** True if at least one of the five upstream payloads is missing
   *  or empty. The view surfaces an "analysis incomplete" hint. */
  incomplete: boolean;
}

// --------------------------------------------------------------------------- //
// Consultant response (Sprint H4)                                            //
// --------------------------------------------------------------------------- //

/**
 * A structured "McKinsey-grade" consultant answer. Every reply
 * is rendered from this shape so the page can compose the 6
 * collapsible sections (Summary, Findings, Recommendations,
 * Impact, Action Plan, Next Questions) deterministically.
 */
export interface ConsultantSection {
  /** Section key. UI uses this to decide which card renders this block. */
  key:
    | "summary"
    | "findings"
    | "recommendations"
    | "impact"
    | "action_plan"
    | "next_questions"
    | "decision";
  /** Section heading shown to the user. */
  title: string;
  /** Short helper line under the heading. */
  caption?: string;
  /**
   * Short prose lines (will render as paragraphs). May be empty
   * when the section is purely a card (e.g. action_plan uses
   * `weeks` instead).
   */
  lines?: string[];
  /** Bullet list under this section. */
  bullets?: ConsultantBullet[];
  /** Free-form markdown-ish body (used by "summary"). */
  body?: string;
  /** Action plan weeks (only for key="action_plan"). */
  weeks?: ActionWeek[];
  /** Decision card payload (only for key="decision"). */
  decision?: DecisionCardPayload;
}

export interface ConsultantBullet {
  id?: string;
  title: string;
  subtitle?: string;
  /** Right-hand badge tone. */
  tone?: "primary" | "success" | "warn" | "danger" | "info" | "violet";
  /** Free-form metadata line. */
  meta?: string;
  /** Optional impact numbers (e.g. "+3 pts", "30% ROI"). */
  impact?: string;
  /** Optional difficulty label (e.g. "Easy", "Moderate"). */
  difficulty?: string;
  /** Optional time required (e.g. "2 weeks"). */
  time?: string;
  /** Optional confidence (0-100). */
  confidence?: number;
  /** Optional "risk if ignored" line. */
  riskIfIgnored?: string;
}

export interface ActionWeek {
  /** Display label, e.g. "Week 1". Legacy alias for `weekLabel`. */
  week: string;
  /** Bullet-list steps inside the week. Legacy alias for `actions`. */
  steps: string[];
  /** 1-based week index. New in H4.2-P1. */
  weekNumber: number;
  /** Heading shown above the steps, e.g. "Week 1 — Discover". */
  weekLabel: string;
  /** Single-line objective for the week, e.g. "Audit digital footprint". */
  objective: string;
  /** Same data as `steps` under a more explicit name. */
  actions: string[];
}

export interface DecisionCardPayload {
  question: string;
  verdict: "YES" | "WAIT" | "NO";
  verdictTone: "success" | "warn" | "danger";
  headline: string;
  why: string;
  risks: string[];
  roi: string;
  timeline: string;
  /** 0..100 deterministic confidence. */
  confidence: number;
}

export interface ConsultantResponse {
  /** Greeting / one-line opener reflecting the user's profile. */
  greeting: string;
  /** Inquiry topic, used by the follow-ups generator. */
  topic: string;
  /** All upstream payload topics the orchestrator drew on. */
  sources: ChatSource[];
  /** Six ordered sections that render the answer. */
  sections: ConsultantSection[];
  /** Plain-text fallback body for legacy callers / export. */
  body: string;
  /** Assistant intent for analytics. */
  kind: QueryKind;
}

// --------------------------------------------------------------------------- //
// Assistant response (the deterministic builder's return shape)
// --------------------------------------------------------------------------- //

export interface AssistantResponse {
  /** Plain-text body. Rendered as paragraphs on `\n\n`, as bullets on `\n- `. */
  body: string;
  /** Source list — shown under the body so the user can see where
   *  the answer came from. Always non-empty. */
  sources: ChatSource[];
  /** Intent that produced the answer. */
  kind: QueryKind;
  /** Optional structured consultant payload (Sprint H4). When the
   *  renderer sees this it prefers the card layout to the prose. */
  consultant?: ConsultantResponse;
}
