"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/Button";
import { Aura, type AuraVariant } from "@/components/ui/Aura";

const DEFAULT_PERKS: [string, string][] = [
  ["Keep what you own", "Every shade, in one place."],
  ["Build looks", "Group products into a routine you can repeat."],
  ["Share the cost", "Send a look to a friend, total included."],
];

/**
 * Wraps anything that needs an account.
 *
 * States what signing in *buys* rather than demanding it. The shade match and
 * the quiz stay open to everyone. An account only exists to keep a vanity
 * between visits, so the gate appears at the point that becomes true and
 * nowhere earlier.
 */
export function SignInGate({
  title,
  reason,
  cta = "Sign in to start your vanity",
  perks = DEFAULT_PERKS,
  aura = "vanity",
  children,
}: {
  title: string;
  reason: string;
  cta?: string;
  perks?: [string, string][];
  aura?: AuraVariant;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded-pill bg-raised" />
        <div className="h-64 animate-pulse rounded-card bg-raised" />
      </div>
    );
  }

  if (user) return <>{children}</>;

  return (
    <>
      <div className="glass grid gap-6 rounded-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:p-5">
        <Aura variant={aura} className="flex min-h-48 items-end p-6 md:min-h-full">
          <p className="text-label uppercase text-text-soft">Free account</p>
        </Aura>

        <div className="flex flex-col p-2 md:p-4">
          <h2 className="text-display font-semibold text-text">{title}</h2>
          <p className="mt-3 max-w-prose text-text-soft">{reason}</p>

          <ul className="mt-6 flex flex-col gap-3">
            {perks.map(([heading, detail]) => (
              <li key={heading} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-vivid" />
                <span>
                  <span className="block font-medium text-text">{heading}</span>
                  <span className="block text-small text-text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => setOpen(true)}>
              {cta}
            </Button>
            <span className="text-small text-text-muted">
              Free, and the shade match works without it.
            </span>
          </div>
        </div>
      </div>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
