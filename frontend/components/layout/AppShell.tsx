"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/Orb";
import { AuthButton } from "@/components/layout/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";

type NavItem = { href: string; label: string; short: string; icon: React.ReactNode };

const ICON = "h-[18px] w-[18px] shrink-0";

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Home",
    short: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={ICON} aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    ),
  },
  {
    href: "/match",
    label: "Shade match",
    short: "Match",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/quiz",
    label: "Skincare quiz",
    short: "Quiz",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON} aria-hidden="true">
        <path d="M9 4h6M10 4v5l-4 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-9V4" />
      </svg>
    ),
  },
  {
    href: "/routine",
    label: "Routine builder",
    short: "Routine",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={ICON} aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h14" /><circle cx="3" cy="6" r=".5" fill="currentColor" /><circle cx="3" cy="12" r=".5" fill="currentColor" /><circle cx="3" cy="18" r=".5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/vanity",
    label: "My vanity",
    short: "Vanity",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={ICON} aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 11h16M9 5v6" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-3 rounded-pill text-[1.375rem] font-semibold tracking-tight text-text", className)}
      aria-label="Tinted home"
    >
      <Orb size="md" />
      Tinted
    </Link>
  );
}

/**
 * Desktop: one large frosted window holding a sticky sidebar and the page.
 * Below lg: the window drops away, a slim top bar keeps the brand and account,
 * and navigation moves to a pill tab bar at the bottom, within thumb reach.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setHasAlerts(false); return; }
    void (async () => {
      try {
        const { count } = await createClient().from("replenishment_alerts")
          .select("id", { count: "exact", head: true })
          .or("flagged_low.eq.true,flagged_empty.eq.true");
        if (!cancelled) setHasAlerts((count ?? 0) > 0);
      } catch { if (!cancelled) setHasAlerts(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="lg:p-6">
      {/* Phone and tablet top bar */}
      <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 lg:hidden">
        <Brand />
        <AuthButton />
      </header>

      <div className="mx-auto lg:glass-window lg:grid lg:min-h-[calc(100dvh-3rem)] lg:max-w-[1440px] lg:grid-cols-[248px_minmax(0,1fr)] lg:rounded-window">
        <aside className="hidden lg:block">
          <div className="sticky top-6 flex h-[calc(100dvh-3rem)] flex-col gap-8 px-6 py-8">
            <Brand />
            <nav aria-label="Main" className="flex flex-col gap-1">
              <p className="mb-2 px-4 text-label uppercase text-text-muted">Discover</p>
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-pill px-4 text-body font-medium",
                      "transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-(--ease-out-soft)",
                      active
                        ? "bg-raised font-semibold text-text shadow-card [&_svg]:text-accent-vivid"
                        : "text-text-soft hover:bg-white/50 hover:text-text",
                    )}
                  >
                    <span className="relative">{item.icon}{item.href === "/vanity" && hasAlerts && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-warn" aria-label="Products need replenishment" />}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-3">
              <p className="px-4 text-label uppercase text-text-muted">Account</p>
              <div className="px-2">
                <AuthButton />
              </div>
            </div>
          </div>
        </aside>

        <main id="main" className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>

      {/* Phone and tablet tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
          <ul className="glass-strong mx-auto grid max-w-lg grid-cols-5 rounded-pill p-1.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-pill text-[0.6875rem] font-medium",
                    "transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out-soft)",
                    active ? "bg-white text-text shadow-card [&_svg]:text-accent-vivid" : "text-text-muted",
                  )}
                >
                  <span className="relative">{item.icon}{item.href === "/vanity" && hasAlerts && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-warn" aria-label="Products need replenishment" />}</span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
