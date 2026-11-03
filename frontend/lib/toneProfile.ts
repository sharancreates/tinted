"use client";

/**
 * The user's last analysis result, persisted across routes.
 *
 * Analysis state lives in the home page component, so anything on another route
 * cannot see it. This persists the reading so future surfaces can, without
 * threading it through the router.
 *
 * localStorage rather than a server record on purpose: this is a measurement of
 * someone's face, it is only useful on the device that took it, and storing it
 * server-side would mean holding biometric-adjacent data we currently don't.
 */

const KEY = "tinted_tone_profile";
/** Fired on window after a new reading is saved, so open panels can update. */
export const TONE_EVENT = "tinted:tone-saved";

export type ToneProfile = {
  mstLevel: number;
  undertone: string;
  avgHex: string;
  /** ISO timestamp — a months-old reading shouldn't be presented as current. */
  savedAt: string;
};

export function saveToneProfile(p: Omit<ToneProfile, "savedAt">): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...p, savedAt: new Date().toISOString() }),
    );
    window.dispatchEvent(new Event(TONE_EVENT));
  } catch {
    // Private mode or storage full. The feature degrades to "no profile yet",
    // which every consumer already handles.
  }
}

export function loadToneProfile(): ToneProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ToneProfile>;
    if (
      typeof parsed.mstLevel !== "number" ||
      typeof parsed.undertone !== "string" ||
      typeof parsed.avgHex !== "string"
    ) {
      return null;
    }
    return {
      mstLevel: parsed.mstLevel,
      undertone: parsed.undertone,
      avgHex: parsed.avgHex,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearToneProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Human-readable age, for telling the user how stale a reading is. */
export function profileAge(p: ToneProfile): string {
  const days = Math.floor(
    (Date.now() - new Date(p.savedAt).getTime()) / 86_400_000,
  );
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "over a month ago";
}
