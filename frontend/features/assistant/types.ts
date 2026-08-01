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
}
