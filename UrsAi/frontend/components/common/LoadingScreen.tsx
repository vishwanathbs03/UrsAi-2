import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  label?: string;
  className?: string;
}

/**
 * Full-viewport loading state with a centered spinner and label.
 * Used for app-level loading boundaries.
 */
export function LoadingScreen({ label = "Loading…", className }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
