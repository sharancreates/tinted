/**
 * Form control styles. Inputs and selects are pills like every other control;
 * text areas get the small radius because a pill reads wrong past one line.
 * Solid-ish white so typed text never sits on moving glass.
 */
const BASE =
  "w-full border border-line bg-raised text-small text-text placeholder:text-text-muted " +
  "shadow-[inset_0_1px_2px_rgba(60,40,70,0.06)] " +
  "transition-[border-color,background-color] duration-(--duration-fast) ease-(--ease-out-soft) " +
  "focus:border-accent focus:bg-white focus:outline-none disabled:opacity-50";

export const FIELD = `${BASE} min-h-12 rounded-pill px-5`;

export const TEXTAREA = `${BASE} min-h-24 rounded-sm px-4 py-3`;

/** Uppercase caption above a control. */
export const FIELD_LABEL = "text-label uppercase text-text-muted";

/** Native checkbox tinted coral. */
export const CHECKBOX = "h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-accent)]";
