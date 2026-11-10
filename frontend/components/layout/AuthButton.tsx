"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function AuthButton({ className }: { className?: string }) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div
        className={cn("h-11 w-24 rounded-pill bg-raised", className)}
        aria-hidden="true"
      />
    );
  }

  if (user) {
    const initial = (user.email?.[0] ?? "?").toUpperCase();
    return (
      <Link
        href="/profile"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          "glass-strong text-small font-semibold text-text",
          "transition-shadow duration-(--duration-fast) hover:shadow-lift",
          className,
        )}
        // The email is the tooltip, but the label has to stand alone for
        // anyone who never sees a tooltip.
        title={user.email ?? "Profile"}
        aria-label={`Your profile, signed in as ${user.email ?? "your account"}`}
      >
        {initial}
      </Link>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className={className}>
        Sign in
      </Button>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
