import { cn } from "@/lib/utils";
import { theme } from "@/lib/theme";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "monochrome" | "dark" | "light";
}

/**
 * Premium modern flat vector logo for UrsBiz.
 * Combines: U + rising analytics growth bars.
 * Legend:
 * - Primary: #2563EB
 * - Secondary: #0F172A
 * - Accent: #14B8A6
 */
export function Logo({
  className,
  withWordmark = true,
  size = "md",
  variant = "default",
}: LogoProps) {
  const dim = size === "sm" ? 24 : size === "lg" ? 40 : 32;
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";

  const primaryColor = variant === "monochrome" ? "currentColor" : "#2563EB";
  const accentColor = variant === "monochrome" ? "currentColor" : "#14B8A6";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Container background */}
        <rect width="32" height="32" rx="8" fill={primaryColor} />
        {/* U shape formed by left bar, bottom curve, and right bar */}
        <path
          d="M8 8V18C8 21.3137 10.6863 24 14 24H18C21.3137 24 24 21.3137 24 18V8"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Accent growth spark bar */}
        <path
          d="M16 12V18"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && (
        <span className={cn("font-bold tracking-tight text-foreground", text)}>
          {theme.brand.name}
        </span>
      )}
    </span>
  );
}
