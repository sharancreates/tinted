"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { orbSettle } from "@/lib/motion";

/** Default orb colour: a coral that sits between the Monk mid-tones. */
export const ORB_DEFAULT = "#e8826a";

const SIZES = {
  xs: "h-4 w-4",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-24 w-24",
  xl: "h-32 w-32 md:h-40 md:w-40",
} as const;

/**
 * The glossy orb: the brand mark, and on results the measured skin tone.
 * `settle` plays the one-time arrival from MASTER.md (blur and 92% → sharp).
 */
export function Orb({
  tone = ORB_DEFAULT,
  size = "md",
  settle = false,
  className,
  label,
}: {
  tone?: string;
  size?: keyof typeof SIZES;
  settle?: boolean;
  className?: string;
  /** Give it a name only when the colour is information, e.g. a measured tone. */
  label?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const style = {
    background: [
      "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0 8%, rgba(255,255,255,0) 32%)",
      "radial-gradient(circle at 70% 78%, rgba(60,20,40,0.28), transparent 55%)",
      `radial-gradient(circle at 50% 50%, ${tone}, color-mix(in srgb, ${tone} 72%, #b5486a))`,
    ].join(", "),
    boxShadow: `0 10px 28px color-mix(in srgb, ${tone} 45%, transparent), inset 0 -4px 12px rgba(60,20,40,0.18)`,
  };
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  if (settle) {
    return (
      <motion.span
        {...orbSettle(reduced)}
        className={cn("inline-block shrink-0 rounded-full", SIZES[size], className)}
        style={style}
        {...a11y}
      />
    );
  }
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", SIZES[size], className)}
      style={style}
      {...a11y}
    />
  );
}
