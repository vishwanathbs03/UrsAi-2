import React from "react";

interface ScoreBadgeProps {
  score: number;
  grade?: string;
  size?: "sm" | "md" | "lg";
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, grade, size = "md" }) => {
  let colorStyle = "bg-rose-500/10 text-rose-500 border-rose-500/20";
  if (score >= 80) {
    colorStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  } else if (score >= 70) {
    colorStyle = "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
  } else if (score >= 60) {
    colorStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-semibold",
    md: "px-2.5 py-1 text-sm font-bold",
    lg: "px-3 py-1.5 text-base font-extrabold",
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${colorStyle} ${sizeClasses}`}>
      <span>{score}</span>
      {grade && <span className="opacity-80">({grade})</span>}
    </span>
  );
};
