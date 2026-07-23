"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

/**
 * Small visible confirmation that the current user is loaded.
 * Doubles as the only place we expose a logout button.
 */
export function DashboardWelcome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const initial = user.full_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {initial}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Signed in as {user.full_name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserIcon className="size-3" aria-hidden="true" />
            {user.email}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onSignOut} disabled={signingOut}>
        <LogOut className="size-4" aria-hidden="true" />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
