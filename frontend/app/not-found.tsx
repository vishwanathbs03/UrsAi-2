"use client";

import Link from "next/link";
import { ArrowLeft, Compass, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center p-6 animate-page-fade">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-soft mb-6">
        <Compass className="size-8 animate-pulse" aria-hidden="true" />
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        404 Error
      </p>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Page Not Found
      </h1>

      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        The destination you are looking for does not exist or has been moved. Use the navigation shortcuts below to get back on track.
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
          <Link href="/dashboard">
            <LayoutDashboard className="size-4" />
            Go to Dashboard
          </Link>
        </Button>

        <Button variant="ghost" asChild className="gap-2">
          <Link href="/">
            <Home className="size-4" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
