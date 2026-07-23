"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface MobileDrawerAuthProps {
  onAction?: () => void;
}

/**
 * Footer of the mobile drawer: shows the public CTAs when logged out
 * and a sign-out button when logged in.
 */
export function MobileDrawerAuth({ onAction }: MobileDrawerAuthProps) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await logout();
      onAction?.();
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (status === "authenticated" && user) {
    return (
      <div className="flex flex-col gap-2 border-t border-border p-4">
        <div className="rounded-md bg-secondary px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{user.full_name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSignOut}
          disabled={busy}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-4">
      <Button asChild variant="outline" className="w-full">
        <Link href="/login" onClick={onAction}>
          Sign in
        </Link>
      </Button>
      <Button asChild className="w-full">
        <Link href="/register" onClick={onAction}>
          Get Started
        </Link>
      </Button>
    </div>
  );
}
