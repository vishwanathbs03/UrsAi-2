"use client";

import { useCallback, useMemo, useState } from "react";
import type { QueryKind } from "./types";

/**
 * Session-only memory — Sprint H4 Module 5.
 *
 * Remembers (in the component-local React state only):
 *   - the user's last N questions + intent kind
 *   - the recommended-action links the orchestrator surfaced
 *   - the topics the consultant has answered
 *
 * The orchestrator reads from this when writing the "Next
 * questions" / "Earlier you asked …" chips so the conversation
 * feels natural across turns.
 *
 * Per the Sprint 7 Part 1 baseline, **memory is component-local
 * and ephemeral** — we explicitly do NOT persist it across
 * hard reloads or share it across tabs. The hook exposes
 * `forget()` so the existing "Clear chat" button can wipe
 * memory atomically.
 */

export interface MemoryEntry {
  /** Stable id (matches the ChatMessage id). */
  id: string;
  /** First 240 chars of the user prompt. */
  prompt: string;
  /** Assistant intent that answered it. */
  kind: QueryKind;
  /** ISO timestamp. */
  createdAt: string;
  /** Optional recommended-action ids the orchestrator returned. */
  actionIds: string[];
  /** Short topic label the orchestrator derived (e.g. "Growth strategy"). */
  topic: string;
}

export interface AssistantMemory {
  /** Past N questions (newest first, capped). */
  recent: MemoryEntry[];
  /** Counts by QueryKind for analytics + memory recall. */
  topicCounts: Record<string, number>;
  /** Topics already answered, deduplicated (insertion order). */
  topicsAnswered: string[];
  /** Last time the orchestrator produced an action plan. */
  lastActionPlanId: string | null;
  /** Recall: list the prompts the user has asked about a topic. */
  recallForTopic(topic: string): MemoryEntry[];
  /** Recall: list the last N prompts across topics. */
  recallRecent(limit?: number): MemoryEntry[];
  /** Append an entry. */
  remember(entry: Omit<MemoryEntry, "createdAt"> & { createdAt?: string }): void;
  /** Wipe everything. */
  forget(): void;
}

const MAX_RECENT = 12;

export function useAssistantMemory(): AssistantMemory {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [lastActionPlanId, setLastActionPlanId] = useState<string | null>(null);

  const remember = useCallback(
    (raw: Omit<MemoryEntry, "createdAt"> & { createdAt?: string }) => {
      const entry: MemoryEntry = {
        id: raw.id,
        prompt: raw.prompt,
        kind: raw.kind,
        topic: raw.topic,
        actionIds: raw.actionIds,
        createdAt: raw.createdAt || new Date().toISOString(),
      };
      setEntries((prev) => {
        const existing = prev.find((p) => p.id === entry.id);
        const next = existing
          ? prev.map((p) => (p.id === entry.id ? entry : p))
          : [...prev, entry];
        // cap the buffer to MAX_RECENT new-to-old
        return next.slice(-MAX_RECENT);
      });
      if (entry.kind === "action_plan") {
        setLastActionPlanId(entry.id);
      }
    },
    [],
  );

  const forget = useCallback(() => {
    setEntries([]);
    setLastActionPlanId(null);
  }, []);

  const topicCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of entries) {
      acc[e.topic] = (acc[e.topic] ?? 0) + 1;
    }
    return acc;
  }, [entries]);

  const topicsAnswered = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      if (!seen.has(e.topic)) {
        seen.add(e.topic);
        out.push(e.topic);
      }
    }
    return out;
  }, [entries]);

  const recallForTopic = useCallback(
    (topic: string) => entries.filter((e) => e.topic === topic),
    [entries],
  );

  const recallRecent = useCallback(
    (limit = 6) => entries.slice(-limit).reverse(),
    [entries],
  );

  return {
    recent: entries.slice().reverse(),
    topicCounts,
    topicsAnswered,
    lastActionPlanId,
    recallForTopic,
    recallRecent,
    remember,
    forget,
  };
}

/**
 * Resolved topic label for a given QueryKind. Pure mapping.
 * Used by the orchestrator + the UI chips.
 */
export function topicForKind(kind: QueryKind): string {
  switch (kind) {
    case "improve_business":
      return "Improve my business";
    case "low_score":
      return "Why is my score low";
    case "what_first":
      return "What should I do first";
    case "export_opportunities":
      return "Export opportunities";
    case "business_dna":
      return "Business DNA";
    case "explain_roadmap":
      return "Roadmap";
    case "explain_recommendations":
      return "Recommendations";
    case "explain_insights":
      return "Insights";
    case "explain_rules":
      return "Rules";
    case "general_overview":
      return "Overview";
    case "growth_strategy":
      return "Business Growth";
    case "digital_transformation":
      return "Digital Transformation";
    case "finance":
      return "Finance";
    case "gst":
      return "GST";
    case "government_schemes":
      return "Government Schemes";
    case "marketing":
      return "Marketing";
    case "operations":
      return "Operations";
    case "hiring":
      return "Hiring";
    case "compliance":
      return "Compliance";
    case "risk":
      return "Risk";
    case "scaling":
      return "Scaling";
    case "decision_hire":
      return "Should I Hire?";
    case "decision_expand":
      return "Should I Expand?";
    case "decision_loan":
      return "Should I apply for a Loan?";
    case "action_plan":
      return "Action Plan";
    case "fallback":
    default:
      return "General";
  }
}
