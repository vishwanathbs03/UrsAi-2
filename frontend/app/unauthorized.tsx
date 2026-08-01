"use client";

import Link from "next/link";
import { Lock, LogIn, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center p-6 animate-page-fade">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-soft mb-6">
        <Lock className="size-8" aria-hidden="true" />
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        401 Unauthorized
      </p>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Access Restricted
      </h1>

      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        You must be signed in to view this analytical surface. Please log in with your credentials to access your business twin and AI insights.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== "undefined") window.history.back();
          }}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Go Back
        </Button>

        <Button asChild className="gap-2">
          <Link href="/login">
            <LogIn className="size-4" />
            Sign In Now
          </Link>
        </Button>
      </div>
    </div>
  );
}
