"use client";

import { cn } from "@/lib/utils";

/**
 * The Monk Skin Tone scale as a visual signature.
 *
 * Every product in this space uses stock beauty photography, which is why they
 * all look alike. Tinted's actual subject is the scale itself — ten measured
 * colours — so the interface is built from that rather than decorated with
 * something borrowed. The same ribbon recurs on the welcome page, during
 * analysis, and in results, which is what makes those screens feel like one
 * product instead of three.
 *
 * MST-1 through MST-10, from Monk et al. (2023). These are the exact values the
 * classifier targets, so the decoration is the data.
 */
export const MONK_TONES = [
  "#f6ede4", "#f3e7db", "#f7ead0", "#eadaba", "#d7bd96",
  "#a07850", "#825c43", "#604134", "#3a312a", "#292420",
] as const;

export function ToneRibbon({
  /** 1–10. Marks a level; omit for the plain ribbon. */
  active,
  orientation = "horizontal",
  /** Thickness. Bars are decorative; `hero` is for the landing page. */
  size = "md",
  /** Accepted for compatibility; the ribbon no longer loops. */
  animate: _animate = false,
  className,
  label,
}: {
  active?: number;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "hero";
  animate?: boolean;
  className?: string;
  label?: string;
}) {
  const vertical = orientation === "vertical";
  const thickness = { sm: "h-1.5", md: "h-3", hero: "h-24 md:h-40" }[size];
  const verticalThickness = { sm: "w-1.5", md: "w-3", hero: "w-24 md:w-40" }[size];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-pill ring-2 ring-white/80",
        vertical ? `flex flex-col ${verticalThickness}` : `flex ${thickness}`,
        className,
      )}
      // Decorative unless it carries a reading, in which case it needs a name.
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {MONK_TONES.map((tone, index) => {
        const level = index + 1;
        const isActive = active === level;
        return (
          <div
            key={tone}
            className={cn(
              "flex-1 transition-opacity duration-(--duration-slow)",
              // Dimming the rest is what makes the marked level read as a
              // measurement rather than a highlight on a palette.
              active !== undefined && !isActive && "opacity-35",
            )}
            style={{ backgroundColor: tone }}
          />
        );
      })}

    </div>
  );
}

/**
 * A single tone as a large disc — the hero element on the results page.
 *
 * The measured colour is the answer, so it gets the visual weight rather than
 * being reduced to a swatch beside a stat.
 */
export function ToneDisc({
  hex,
  size = "md",
  className,
}: {
  hex: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = {
    sm: "h-14 w-14",
    md: "h-24 w-24",
    lg: "h-32 w-32 md:h-44 md:w-44",
  }[size];

  return (
    <span
      className={cn("relative shrink-0 rounded-full", dimensions, className)}
      style={{
        backgroundColor: hex,
        // A soft bloom in the measured colour itself, so the page picks up the
        // user's tone rather than imposing one.
        boxShadow: `0 0 0 1px rgba(255,255,255,0.14), 0 24px 60px -20px ${hex}80`,
      }}
      aria-hidden="true"
    />
  );
}
