/**
 * Tailwind classes for level/band colour coding. Centralised so
 * the dashboard does not sprinkle hard-coded greens and reds
 * across the cards.
 */

export type Level = "low" | "medium" | "high" | string;
export type ScoreBand = "Low" | "Medium" | "High" | "Excellent" | string;

export function levelToTone(level: Level): string {
  const l = (level || "").toLowerCase();
  if (l === "excellent" || l === "high") return "bg-emerald-100 text-emerald-700";
  if (l === "medium") return "bg-amber-100 text-amber-800";
  if (l === "low") return "bg-rose-100 text-rose-700";
  return "bg-secondary text-muted-foreground";
}

export function scoreTone(band: ScoreBand): string {
  if (band === "Excellent") return "text-emerald-600";
  if (band === "High") return "text-emerald-600";
  if (band === "Medium") return "text-amber-600";
  if (band === "Low") return "text-rose-600";
  return "text-muted-foreground";
}

export function scoreFill(band: ScoreBand): string {
  if (band === "Excellent" || band === "High") return "bg-emerald-500";
  if (band === "Medium") return "bg-amber-500";
  if (band === "Low") return "bg-rose-500";
  return "bg-primary";
}

/**
 * Card-edge accent for a score-card surface. Used by
 * Sprint 4 colour-coded score cards: a 4-px left border
 * whose colour matches the band. Returned as a Tailwind
 * utility class (NOT a CSS variable) so the same pattern
 * works in both light and dark themes.
 */
export function scoreEdgeTone(band: ScoreBand): string {
  if (band === "Excellent") return "border-l-emerald-500";
  if (band === "High") return "border-l-emerald-400";
  if (band === "Medium") return "border-l-amber-400";
  if (band === "Low") return "border-l-rose-400";
  return "border-l-border";
}

/**
 * Soft surface tint for a score-card body. Pairs with
 * `scoreEdgeTone` so the card has both a left rail and a
 * subtle background wash without being garish.
 */
export function scoreSurfaceTone(band: ScoreBand): string {
  if (band === "Excellent" || band === "High") return "bg-emerald-50/40";
  if (band === "Medium") return "bg-amber-50/40";
  if (band === "Low") return "bg-rose-50/40";
  return "bg-secondary/30";
}

/**
 * DNA confidence -> label + tone. The DNA engine returns a
 * 0..100 confidence number; we bucket it into High / Medium
 * / Low and pick a consistent Tailwind tone.
 */
export function confidenceToTone(
  confidence: number,
): { label: string; tone: string } {
  if (!Number.isFinite(confidence)) {
    return { label: "Unknown", tone: "bg-secondary text-muted-foreground" };
  }
  if (confidence >= 70) {
    return { label: "High confidence", tone: "bg-emerald-100 text-emerald-700" };
  }
  if (confidence >= 40) {
    return { label: "Medium confidence", tone: "bg-amber-100 text-amber-800" };
  }
  return { label: "Low confidence", tone: "bg-rose-100 text-rose-700" };
}
