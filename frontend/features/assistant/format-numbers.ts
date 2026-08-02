/**
 * Tiny deterministic formatters used by the consultant
 * orchestrator. Pure functions, no locale sensitivity beyond
 * Indian grouping. Kept separate so the orchestrator can stay
 * focused on structure.
 */

export function formatScoreGain(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)} pts`;
}

export function formatRoi(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  let scaled = value;
  let suffix = "";
  if (abs >= 1_00_00_000) {
    scaled = value / 1_00_00_000;
    suffix = " Cr";
  } else if (abs >= 1_00_000) {
    scaled = value / 1_00_000;
    suffix = " L";
  } else if (abs >= 1_000) {
    scaled = value / 1_000;
    suffix = "k";
  }
  const fixed = abs >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `₹${fixed}${suffix}`;
}