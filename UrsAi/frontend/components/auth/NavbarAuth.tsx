"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

/**
 * Auth-aware section of the navbar. Renders the public CTA pair
 * when no session exists, and a user chip + sign-out button when
 * one does.
 */
export function NavbarAuth() {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onSignOut = async () => {
    setBusy(true);
    try {
      await logout();
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // While we're checking the session, render the public CTAs to avoid
  // a flicker. Once we know the user is signed in, swap them out.
  if (status === "authenticated" && user) {
    const initial = user.full_name.trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="hidden items-center gap-3 md:flex">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1">
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            {initial}
          </span>
          <span className="text-sm font-medium text-foreground">
            {user.full_name}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut} disabled={busy}>
          <LogOut className="size-4" aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">Get Started</Link>
      </Button>
    </div>
  );
}
