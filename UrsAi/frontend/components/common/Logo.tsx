import { cn } from "@/lib/utils";
import { theme } from "@/lib/theme";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Brand logo. Pure SVG so it renders crisply at any size and inherits
 * currentColor in dark mode without extra wiring.
 */
export function Logo({ className, withWordmark = true, size = "md" }: LogoProps) {
  const dim = size === "sm" ? 24 : size === "lg" ? 40 : 32;
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";

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
        <defs>
          <linearGradient id="atlasGradient" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="hsl(221 83% 53%)" />
            <stop offset="100%" stopColor="hsl(217 91% 60%)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#atlasGradient)" />
        <path
          d="M8 22 L16 8 L24 22"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="20" r="1.6" fill="white" />
      </svg>
      {withWordmark && (
        <span className={cn("font-semibold tracking-tight", text)}>
          {theme.brand.name}
        </span>
      )}
    </span>
  );
}
