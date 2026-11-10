"use client";

import { useState } from "react";
import { pillClass } from "@/components/ui/PillGroup";
import { pct, seqFill, seqInk, MST_HEX } from "@/lib/eval";
import { cn } from "@/lib/utils";
import { LevelPill, LIFT, Tip } from "./charts";

export type Matrix = {
  /** confusion[true - 1][predicted - 1] */
  confusion: number[][];
  /** Share of each true level that was refused, when known. */
  rowRefused?: (number | null)[];
  exact: number | null;
  within1: number | null;
  mean_bias: number | null;
};

type Option = { key: string; label: string };

/**
 * True level down the side, predicted level across the top. Each cell is
 * shaded by its share of that row, so a level with few samples still shows
 * where its errors go. The diagonal is a correct answer.
 *
 * `views` are the main toggle (lighting); `variants` an optional second one
 * (white balance on or off). `matrices` is keyed "view|variant", precomputed
 * on the server because functions cannot cross into a client component.
 */
export function ConfusionMatrix({
  views,
  variants,
  matrices,
  label,
}: {
  views: Option[];
  variants?: Option[];
  matrices: Record<string, Matrix>;
  label: string;
}) {
  const [view, setView] = useState(views[0].key);
  const [variant, setVariant] = useState(variants?.[0].key ?? "");
  const m = matrices[`${view}|${variant}`];
  const viewLabel = views.find((v) => v.key === view)?.label ?? view;
  const variantLabel = variants?.find((v) => v.key === variant)?.label;
  const context = [viewLabel, variantLabel].filter(Boolean).join(", ");
  const bias = m.mean_bias ?? 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={`${label}: view`} className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)} className={pillClass(view === v.key, "min-h-9 px-3.5")}>
              {v.label}
            </button>
          ))}
        </div>
        {variants && (
          <div role="group" aria-label={`${label}: variant`} className="flex gap-1.5">
            {variants.map((v) => (
              <button key={v.key} type="button" aria-pressed={variant === v.key} onClick={() => setVariant(v.key)} className={pillClass(variant === v.key, "min-h-9 px-3.5")}>
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] table-fixed border-separate border-spacing-1 text-small">
          <caption className="sr-only">
            {label}, {context}. Rows are the true level, columns the predicted level.
          </caption>
          <thead>
            <tr>
              <th className="w-14">
                <span className="sr-only">True level</span>
              </th>
              {MST_HEX.map((hex, i) => (
                <th key={i} scope="col" className="pb-1.5 font-normal">
                  <LevelPill hex={hex} level={i + 1} className="h-6 w-full max-w-9" />
                </th>
              ))}
              {m.rowRefused && (
                <th scope="col" className="w-16 pb-1.5 pl-2 text-right font-medium text-text-muted">
                  Refused
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {m.confusion.map((row, i) => {
              const total = row.reduce((a, b) => a + b, 0);
              return (
                <tr key={i}>
                  <th scope="row" className="pr-2 text-left font-normal">
                    <LevelPill hex={MST_HEX[i]} level={i + 1} />
                  </th>
                  {row.map((count, j) => {
                    const share = total ? count / total : 0;
                    return (
                      <Tip
                        as="td"
                        key={j}
                        className="h-9 rounded-sm p-0"
                        tip={
                          <>
                            True MST {i + 1}, predicted MST {j + 1}
                            <br />
                            <span className="font-semibold tabular-nums">{count}</span> of {total} answered ({pct(share)})
                          </>
                        }
                      >
                        <span
                          className={cn("flex h-full items-center justify-center rounded-sm font-medium tabular-nums", count > 0 && LIFT)}
                          style={{
                            background: count ? seqFill(share) : "rgba(94,84,76,0.05)",
                            color: count ? seqInk(share) : "rgba(94,84,76,0.35)",
                            boxShadow: i === j ? "inset 0 0 0 2px rgba(43,36,32,0.5)" : undefined,
                          }}
                        >
                          {count || "·"}
                        </span>
                      </Tip>
                    );
                  })}
                  {m.rowRefused && <td className="pl-2 text-right tabular-nums text-text-muted">{total || m.rowRefused[i] ? pct(m.rowRefused[i]) : "–"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-small text-text-muted">
        Rows are the true level, columns what the pipeline answered. Outlined cells are correct. Shade shows each cell&apos;s share of its
        row. {context}: {pct(m.exact, 1)} exact and {pct(m.within1, 1)} within one level of the photos it answered, average lean{" "}
        {bias >= 0 ? "+" : ""}
        {bias.toFixed(2)} levels{bias > 0.3 ? " (reads too deep)" : bias < -0.3 ? " (reads too light)" : ""}.
      </p>
    </div>
  );
}
