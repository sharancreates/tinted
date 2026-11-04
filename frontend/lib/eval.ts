import raw from "./eval-report.json";

/**
 * Types for lib/eval-report.json, which backend/eval/pipeline_sim.py writes.
 * Regenerate it with:
 *   cd backend && python eval/pipeline_sim.py --out ../frontend/lib/eval-report.json \
 *     --samples ../frontend/public/eval --baseline <earlier report>
 */

export type LevelStat = {
  level: number;
  n: number;
  exact: number | null;
  within1: number | null;
  rejection_rate: number | null;
  mean_bias: number | null;
};

export type CellSummary = {
  n: number;
  measured: number;
  rejected: number;
  exact: number | null;
  within1: number | null;
  exact_of_all: number | null;
  within1_of_all: number | null;
  rejection_rate: number | null;
  mean_bias: number | null;
  mean_delta_e: number | null;
  /** confusion[true - 1][predicted - 1] */
  confusion: number[][];
  per_level: LevelStat[];
};

export type LightingKey = "daylight" | "warm" | "cool" | "low";

export type EvalReport = {
  meta: {
    kind: string;
    subjects_per_level: number;
    scenes: number;
    seed: number;
    jpeg_quality: number;
    image_size: number;
    generated: string;
  };
  lighting: { key: LightingKey; label: string; description: string; gains: number[] }[];
  levels: { level: number; hex: string }[];
  overall: Record<"on" | "off", CellSummary>;
  by_lighting: Record<"on" | "off", Record<LightingKey, CellSummary>>;
  stage: {
    margins: { level: number; hex: string; nearest_level: number; nearest_distance: number; safe_radius: number }[];
    noise: { sigma: number; overall: number; per_level: Record<string, number> }[];
    illuminant: { b_shift: number; correct: number; total: number; flips: Record<string, number> }[];
  };
  baseline?: {
    note: string;
    by_lighting: Record<
      LightingKey,
      { rejection_rate: number | null; exact_of_all: number | null; within1_of_all: number | null; per_level_rejection: (number | null)[] }
    >;
  };
};

export const report = raw as unknown as EvalReport;

export function pct(v: number | null | undefined, digits = 0): string {
  return v == null ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}

/**
 * Sequential ramp for magnitude: one hue (the brand coral), light to dark.
 * t is 0..1.
 */
export function seq(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  return `color-mix(in oklab, #b4431e ${Math.round(clamped * 100)}%, #fbf3ef)`;
}

/** Ink for text set inside a seq() fill. */
export function seqInk(t: number): string {
  return t > 0.55 ? "#ffffff" : "#211d26";
}

/** The two comparison series. Validated as a pair (dataviz validator, light). */
export const SERIES = {
  before: "#7a5fc0",
  after: "#b4431e",
} as const;
