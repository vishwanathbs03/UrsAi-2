"use client";

import { ErrorState } from "@/components/common/ErrorState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="container flex min-h-screen items-center justify-center">
          <ErrorState
            title="Something went wrong"
            description={
              error.message ||
              "An unexpected error occurred. Please try again in a moment."
            }
            actionLabel="Try again"
            onAction={reset}
          />
        </div>
      </body>
    </html>
  );
}
