/**
 * Centralized theme configuration.
 *
 * Single source of truth for brand colors, gradients, and visual tokens
 * that components reference. Keeps the visual system consistent.
 */

export const theme = {
  brand: {
    name: "UrsBiz",
    tagline: "AI-Powered Business Intelligence Platform",
  },
  colors: {
    primary: "hsl(var(--primary))",
    primaryFg: "hsl(var(--primary-foreground))",
    muted: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
  },
  radius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
  },
  shadow: {
    soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.05)",
    card: "0 4px 12px -2px rgb(15 23 42 / 0.06), 0 2px 6px -2px rgb(15 23 42 / 0.04)",
    elevated:
      "0 10px 30px -10px rgb(15 23 42 / 0.15), 0 4px 8px -4px rgb(15 23 42 / 0.08)",
  },
} as const;

export type Theme = typeof theme;
