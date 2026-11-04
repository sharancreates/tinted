"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/Orb";
import { AuthButton } from "@/components/layout/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";

type NavItem = { href: string; label: string; short: string; icon: React.ReactNode; group: "discover" | "collection" | "account"; mobile?: boolean };

const ICON = "h-[18px] w-[18px] shrink-0";

const NAV: NavItem[] = [
  {
    href: "/",
    group: "discover",
    mobile: true,
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
    group: "discover",
    mobile: true,
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
    href: "/find-shade",
    group: "discover",
    label: "Shade finder",
    short: "Finder",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={ICON} aria-hidden="true">
        <rect x="8" y="2.5" width="8" height="5" rx="1.5" />
        <path d="M7 7.5h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
        <path d="M7 13h10" />
      </svg>
    ),
  },
  {
    href: "/quiz",
    group: "discover",
    mobile: true,
    label: "Skincare quiz",
    short: "Quiz",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON} aria-hidden="true">
        <path d="M9 4h6M10 4v5l-4 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-9V4" />
      </svg>
    ),
  },
  {
    href: "/eval",
    group: "discover",
    label: "Accuracy",
    short: "Accuracy",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={ICON} aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    href: "/vanity",
    group: "collection",
    mobile: true,
    label: "Vanity",
    short: "Vanity",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={ICON} aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 11h16M9 5v6" />
      </svg>
    ),
  },
  {
    href: "/routine",
    group: "collection",
    mobile: true,
    label: "Routine builder",
    short: "Routine",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={ICON} aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h14" /><circle cx="3" cy="6" r=".5" fill="currentColor" /><circle cx="3" cy="12" r=".5" fill="currentColor" /><circle cx="3" cy="18" r=".5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/vanity/looks",
    group: "collection",
    label: "Looks",
    short: "Looks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={ICON} aria-hidden="true">
        <circle cx="8" cy="9" r="4" /><circle cx="16" cy="9" r="4" /><circle cx="12" cy="16" r="4" />
      </svg>
    ),
  },
  {
    href: "/profile",
    group: "account",
    label: "Profile",
    short: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={ICON} aria-hidden="true">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
      </svg>
    ),
  },
];

const GROUPS = [
  { id: "discover", label: "Discover" },
  { id: "collection", label: "My collection" },
  { id: "account", label: "Account" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // Looks lives under /vanity but has its own entry, so Vanity must not
  // light up there too.
  if (href === "/vanity") return pathname === "/vanity";
  return pathname.startsWith(href);
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
            <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto">
              {GROUPS.map((group) => (
                <div key={group.id} className="flex flex-col gap-1">
                  <p className="mb-1 px-4 text-label uppercase text-text-muted">{group.label}</p>
                  {NAV.filter((item) => item.group === group.id).map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-pill px-4 text-body font-medium",
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
                  {group.id === "account" && <AccountRow />}
                </div>
              ))}
            </nav>
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
          {NAV.filter((item) => item.mobile).map((item) => {
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

/** Sign in when signed out; who you are and a way out when signed in. */
function AccountRow() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  if (loading) return <div className="mx-2 mt-1 h-11 rounded-pill bg-raised" aria-hidden="true" />;
  if (!user) return <div className="mt-1 px-2"><AuthButton /></div>;
  return (
    <div className="mt-1 flex items-center gap-3 px-4">
      <span className="min-w-0 flex-1 truncate text-small text-text-muted" title={user.email ?? undefined}>
        {user.email}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); await createClient().auth.signOut(); setBusy(false); }}
        className="min-h-11 shrink-0 cursor-pointer text-small font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  );
}
