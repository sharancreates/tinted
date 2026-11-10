import raw from "./eval-report.json";
import photosRaw from "./mste-report.json";

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
 * Sequential ramp for magnitude, warm and single-family: pale peach through
 * peach to deep coral, lightness falling the whole way. t is 0..1.
 */
export function seq(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5
    ? `color-mix(in oklab, #e8955f ${Math.round(c * 200)}%, #fcefe6)`
    : `color-mix(in oklab, #a64b2c ${Math.round((c - 0.5) * 200)}%, #e8955f)`;
}

/** A soft gradient fill for a cell of value t: a lighter sheen into seq(t). */
export function seqFill(t: number): string {
  return `linear-gradient(150deg, color-mix(in oklab, ${seq(t)} 72%, #ffffff), ${seq(t)} 70%)`;
}

/** Ink for text set inside a seq() fill. */
export function seqInk(t: number): string {
  return t > 0.62 ? "#ffffff" : "#2b2420";
}

/**
 * The two comparison series, coral family. Validated as a pair on cream with
 * the dataviz validator; the peach is under 3:1 on cream, so both series are
 * always direct-labelled and a table view exists.
 */
export const SERIES = {
  before: "#e8955f",
  after: "#a64b2c",
} as const;

/** Monk reference colours, MST 1 to 10. */
export const MST_HEX = report.levels.map((l) => l.hex);

/**
 * Whichever ink, warm black or white, contrasts more with the swatch. The
 * crossover sits at relative luminance 0.18; MST 6 (#a07850) is the worst
 * case at 3.9:1 either way, so level pills are always semibold.
 */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.18 ? "#2b2420" : "#ffffff";
}

// ── Real photographs (backend/eval/mste_eval.py on Google's MST-E) ──────────



export type PhotoSummary = {
  n: number;
  measured: number;
  rejected: number;
  exact: number | null;
  within1: number | null;
  exact_of_all: number | null;
  within1_of_all: number | null;
  rejection_rate: number | null;
  mean_bias: number | null;
  confusion: number[][];
  refusal_reasons: Record<string, number>;
};

export type PhotoReport = {
  meta: { kind: "photos"; dataset: string; terms: string; photos: number; people: number; skipped: Record<string, number>; generated: string };
  overall: PhotoSummary;
  intervals: Record<"exact_of_all" | "within1_of_all" | "within1", [number, number] | null>;
  people_within1: number | null;
  levels_covered: number[];
  by_lighting: Record<string, PhotoSummary & { label: string }>;
  by_pose: Record<string, PhotoSummary>;
  by_level: Record<string, PhotoSummary>;
  people: {
    id: string;
    mst: number;
    photos: number;
    exact: number | null;
    within1: number | null;
    rejection_rate: number | null;
    typical_prediction: number | null;
  }[];
};

export const photos = photosRaw as unknown as PhotoReport;
