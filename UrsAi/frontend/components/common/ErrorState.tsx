import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Friendly error fallback for both route-level errors and inline
 * component failures. Honors role="alert" so screen readers announce
 * the error immediately.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  actionLabel = "Try again",
  onAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onAction && (
        <Button onClick={onAction} variant="outline" className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
