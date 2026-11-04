import { cn } from "@/lib/utils";
import { SERIES, seq, seqInk } from "@/lib/eval";

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
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-56 -translate-x-1/2 rounded-sm border border-white bg-white px-3 py-2 text-left text-small text-text opacity-0 shadow-lift transition-opacity duration-(--duration-fast) group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
      >
        {tip}
      </span>
    </Tag>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small text-text-soft">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
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
 * Two horizontal bars per row: a comparison series and the current one.
 * Bars grow from one baseline, 12px thick with a 2px gap, 4px rounded ends.
 * Only the current value is printed; both are in the tooltip and the table.
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
    <div className="flex flex-col gap-5">
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
          className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 rounded-sm sm:grid-cols-[9rem_minmax(0,1fr)]"
        >
          <span className="text-small">
            <span className="block font-medium text-text">{row.label}</span>
            {row.sub && <span className="block text-text-muted">{row.sub}</span>}
          </span>
          <span className="flex flex-col gap-0.5 border-l border-line-strong py-1">
            <span className="flex h-3 items-center">
              <span className="h-3 rounded-r-[4px]" style={{ width: width(row.before), background: SERIES.before }} />
            </span>
            <span className="flex h-3 items-center gap-2">
              <span className="h-3 rounded-r-[4px]" style={{ width: width(row.after), background: SERIES.after }} />
              <span className="text-small font-semibold tabular-nums text-text">{format(row.after)}</span>
            </span>
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
    <details className="group mt-6 text-small">
      <summary className="cursor-pointer text-text-muted hover:text-text">Show as a table</summary>
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

/** Square swatch for an MST level, used as an axis label. */
export function LevelChip({ hex, level, className }: { hex: string; level: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-small tabular-nums text-text-soft", className)}>
      <span aria-hidden="true" className="h-3.5 w-3.5 rounded-[4px] ring-1 ring-black/5" style={{ background: hex }} />
      {level}
    </span>
  );
}

/**
 * Levels down the side, conditions across the top, each cell filled on the
 * sequential coral ramp by its value. Null cells read as "no data".
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] table-fixed border-separate border-spacing-0.5 text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="w-14 pb-2 text-left text-label font-medium uppercase text-text-muted">MST</th>
            {columns.map((c) => (
              <th key={c.key} className="pb-2 text-center font-medium text-text-soft">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map(({ level, hex }) => (
            <tr key={level}>
              <th scope="row" className="pr-2 text-left font-normal">
                <LevelChip hex={hex} level={level} />
              </th>
              {columns.map((c) => {
                const v = value(level, c.key);
                return (
                  <Tip as="td" key={c.key} tip={tip(level, c.key)} className="h-9 rounded-[4px] p-0 text-center">
                    <span
                      className="flex h-full items-center justify-center rounded-[4px] tabular-nums"
                      style={
                        v == null
                          ? { background: "rgba(98,91,107,0.08)", color: "#625b6b" }
                          : { background: seq(v), color: seqInk(v) }
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
