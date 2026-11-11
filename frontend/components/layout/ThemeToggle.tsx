"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  ThemeMode,
  applyTheme,
  getThemeSnapshot,
  subscribeTheme,
} from "@/lib/theme";

const SERVER_SNAPSHOT = { theme: "system" as ThemeMode, storageFailed: false };

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { theme, storageFailed } = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const updateThemeMode = (nextTheme: ThemeMode) => {
    applyTheme(nextTheme);
  };

  const cycleTheme = () => {
    if (theme === "system") updateThemeMode("light");
    else if (theme === "light") updateThemeMode("dark");
    else updateThemeMode("system");
  };

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-pill border border-line bg-raised/60 px-2.5 py-1",
          "text-small font-medium text-text-soft transition-colors duration-[var(--duration-fast)]",
          className,
        )}
        aria-hidden="true"
      >
        <svg
          className="h-4 w-4 text-text-muted/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path strokeLinecap="round" d="M8 20h8m-4-4v4" />
        </svg>
        <span className="hidden sm:inline text-xs text-text-muted/40">Auto</span>
      </div>
    );
  }

  const baseLabel =
    theme === "system"
      ? "Theme: System (switch to Light)"
      : theme === "light"
      ? "Theme: Light (switch to Dark)"
      : "Theme: Dark (switch to System)";

  const title = storageFailed
    ? `${baseLabel} — session only (browser storage is unavailable)`
    : baseLabel;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={title}
      title={title}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-pill border border-line bg-raised/60 px-2.5 py-1",
        "text-small font-medium text-text-soft transition-colors duration-[var(--duration-fast)]",
        "hover:bg-raised hover:text-text focus-visible:outline-2",
        className,
      )}
    >
      {theme === "light" && (
        <>
          <svg
            className="h-4 w-4 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
          <span className="hidden sm:inline text-xs">Light</span>
        </>
      )}
      {theme === "dark" && (
        <>
          <svg
            className="h-4 w-4 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <span className="hidden sm:inline text-xs">Dark</span>
        </>
      )}
      {theme === "system" && (
        <>
          <svg
            className="h-4 w-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path strokeLinecap="round" d="M8 20h8m-4-4v4" />
          </svg>
          <span className="hidden sm:inline text-xs">Auto</span>
        </>
      )}
      {storageFailed && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-warn"
          title="Preference applies to this session only because browser storage is disabled"
          aria-label="Storage unavailable; preference applies to this session only"
        />
      )}
    </button>
  );
}
