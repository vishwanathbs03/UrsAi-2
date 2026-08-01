import React from "react";

interface InsightChipProps {
  label: string;
  variant?: "high" | "medium" | "low" | "critical" | "default";
}

export const InsightChip: React.FC<InsightChipProps> = ({ label, variant = "default" }) => {
  const normalized = variant.toLowerCase();
  let styles = "bg-muted text-muted-foreground border-border";

  if (normalized === "high" || normalized === "critical") {
    styles = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  } else if (normalized === "medium") {
    styles = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  } else if (normalized === "low") {
    styles = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
};
