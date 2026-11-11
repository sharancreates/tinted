import { cn } from "@/lib/utils";
import { SERIES, inkOn, seqFill, seqInk } from "@/lib/eval";

/** Hover lift shared by every interactive mark. Movement only when allowed. */
export const LIFT =
  "transition-[transform,box-shadow,filter] duration-(--duration-fast) ease-(--ease-out-soft) " +
  "motion-safe:group-hover/tip:-translate-y-0.5 group-hover/tip:shadow-card group-hover/tip:brightness-[1.03] " +
  "motion-safe:group-focus-visible/tip:-translate-y-0.5 group-focus-visible/tip:shadow-card";

/**
 * Hover and keyboard tooltip, CSS only. The trigger is focusable so the same
 * detail reaches keyboard users; the hit area is the whole wrapped element.
 */
export function Tip({
  tip,
  children,
  className,
  as: Tag = "div",
}: {
  tip: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "div" | "td";
}) {
  return (
    <Tag tabIndex={0} className={cn("group/tip relative outline-none focus-visible:ring-2 focus-visible:ring-accent", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-60 -translate-x-1/2 translate-y-1 rounded-tile border border-line bg-surface px-3.5 py-2.5 text-left text-small text-text opacity-0 shadow-lift transition-[opacity,transform] duration-(--duration-fast) ease-(--ease-out-soft) group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100"
      >
        {tip}
      </span>
    </Tag>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-small text-text-soft">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-5 rounded-pill" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type PairRow = {
  key: string;
  label: string;
  sub?: string;
  before: number | null;
  after: number | null;
};

/**
 * Two horizontal bars per row, peach for the comparison and deep coral for
 * the current value. Rounded data ends, both values printed (the peach is low
 * contrast on cream, so it never relies on colour alone). The row warms on
 * hover and shows both values in a tooltip.
 */
export function PairBars({
  rows,
  max,
  format,
  labels,
}: {
  rows: PairRow[];
  max: number;
  format: (v: number | null) => string;
  labels: { before: string; after: string };
}) {
  const width = (v: number | null) => `${Math.max(0, Math.min(1, (v ?? 0) / max)) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <Tip
          key={row.key}
          tip={
            <>
              <span className="block font-semibold">{row.label}</span>
              {labels.before}: {format(row.before)}
              <br />
              {labels.after}: {format(row.after)}
            </>
          }
          className={cn(
            "grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 rounded-tile px-3 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]",
            "transition-colors duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-peach/60 focus-visible:bg-peach/60",
          )}
        >
          <span>
            <span className="block font-display text-[1.125rem] leading-tight text-text">{row.label}</span>
            {row.sub && <span className="mt-0.5 block text-small text-text-muted">{row.sub}</span>}
          </span>
          <span className="flex min-w-0 flex-col gap-1.5">
            {(["before", "after"] as const).map((k) => (
              <span key={k} className="flex h-3.5 items-center gap-2.5">
                <span
                  className="h-full rounded-pill transition-[filter] duration-(--duration-fast) ease-(--ease-out-soft) group-hover/tip:brightness-105"
                  style={{
                    width: width(row[k]),
                    background: `linear-gradient(90deg, color-mix(in oklab, ${SERIES[k]} 70%, #ffffff), ${SERIES[k]})`,
                  }}
                />
                <span className={cn("shrink-0 text-small tabular-nums", k === "after" ? "font-semibold text-text" : "text-text-soft")}>
                  {format(row[k])}
                </span>
              </span>
            ))}
          </span>
        </Tip>
      ))}
    </div>
  );
}

/** A plain table version of a PairBars chart, behind a disclosure. */
export function PairTable({
  rows,
  format,
  labels,
  caption,
}: {
  rows: PairRow[];
  format: (v: number | null) => string;
  labels: { before: string; after: string };
  caption: string;
}) {
  return (
    <details className="group mt-5 text-small">
      <summary className="cursor-pointer text-text-muted transition-colors duration-(--duration-fast) hover:text-accent">Show as a table</summary>
      <table className="mt-3 w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-text-muted">
            <th className="py-1.5 font-medium">Condition</th>
            <th className="py-1.5 text-right font-medium">{labels.before}</th>
            <th className="py-1.5 text-right font-medium">{labels.after}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line-strong">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right tabular-nums">{format(row.before)}</td>
              <td className="py-1.5 text-right tabular-nums">{format(row.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** A Monk level as a pill filled with its own reference colour. */
export function LevelPill({ hex, level, className }: { hex: string; level: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-9 items-center justify-center rounded-pill text-small font-semibold tabular-nums shadow-[inset_0_0_0_1px_rgba(43,36,32,0.08)]",
        className,
      )}
      style={{ background: hex, color: inkOn(hex) }}
    >
      <span className="sr-only">MST </span>
      {level}
    </span>
  );
}

/**
 * Levels down the side as colour pills, conditions across the top, each cell
 * a soft gradient on the warm ramp. Null cells read as "no data".
 */
export function HeatGrid({
  levels,
  columns,
  value,
  tip,
  format,
  caption,
}: {
  levels: { level: number; hex: string }[];
  columns: { key: string; label: string }[];
  value: (level: number, col: string) => number | null;
  tip: (level: number, col: string) => React.ReactNode;
  format: (v: number | null) => string;
  caption: string;
}) {
  return (
    // Scrolls only on phones: on wider screens the grid fits, and an
    // always-on scroller picks up phantom overflow from the hidden tooltips.
    <div className="max-sm:overflow-x-auto">
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-1 text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="w-14 pb-1 text-left text-label font-medium uppercase text-text-muted">MST</th>
            {columns.map((c) => (
              <th key={c.key} className="pb-1 text-center font-medium text-text-soft">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map(({ level, hex }) => (
            <tr key={level}>
              <th scope="row" className="pr-1 text-left font-normal">
                <LevelPill hex={hex} level={level} />
              </th>
              {columns.map((c) => {
                const v = value(level, c.key);
                return (
                  <Tip as="td" key={c.key} tip={tip(level, c.key)} className="h-10 rounded-sm p-0">
                    <span
                      className={cn("flex h-full items-center justify-center rounded-sm tabular-nums", LIFT)}
                      style={
                        v == null
                          ? { background: "rgba(94,84,76,0.07)", color: "#6b6058" }
                          : { background: seqFill(v), color: seqInk(v) }
                      }
                    >
                      {format(v)}
                    </span>
                  </Tip>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
