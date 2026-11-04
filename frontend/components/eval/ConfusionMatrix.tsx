"use client";

import { useState } from "react";
import { pillClass } from "@/components/ui/PillGroup";
import { report, pct, seq, seqInk, type LightingKey } from "@/lib/eval";
import { LevelChip, Tip } from "./charts";

/**
 * True level down the side, predicted level across the top. Each cell is
 * shaded by its share of that row, so a level with few samples still shows
 * where its errors go. The diagonal is a correct answer.
 */
export function ConfusionMatrix() {
  const [light, setLight] = useState<LightingKey>("daylight");
  const [wb, setWb] = useState<"on" | "off">("on");
  const cell = report.by_lighting[wb][light];
  const levels = report.levels;
  const lightLabel = report.lighting.find((l) => l.key === light)?.label ?? light;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Lighting" className="flex flex-wrap gap-1.5">
          {report.lighting.map((l) => (
            <button key={l.key} type="button" aria-pressed={light === l.key} onClick={() => setLight(l.key)} className={pillClass(light === l.key, "min-h-9 px-3.5")}>
              {l.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="White balance" className="flex gap-1.5">
          {(["on", "off"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={wb === v} onClick={() => setWb(v)} className={pillClass(wb === v, "min-h-9 px-3.5")}>
              White balance {v}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-separate border-spacing-0.5 text-small">
          <caption className="sr-only">
            Confusion matrix, {lightLabel}, white balance {wb}. Rows are the true level, columns the predicted level.
          </caption>
          <thead>
            <tr>
              <th className="w-14 text-left align-bottom text-label font-medium uppercase text-text-muted">
                <span className="sr-only">True level</span>
              </th>
              {levels.map(({ level, hex }) => (
                <th key={level} scope="col" className="pb-1.5 font-normal">
                  <LevelChip hex={hex} level={level} className="justify-center" />
                </th>
              ))}
              <th scope="col" className="pb-1.5 pl-2 text-right font-medium text-text-muted">Refused</th>
            </tr>
          </thead>
          <tbody>
            {cell.confusion.map((row, i) => {
              const stat = cell.per_level[i];
              const total = row.reduce((a, b) => a + b, 0);
              return (
                <tr key={i}>
                  <th scope="row" className="pr-2 text-left font-normal">
                    <LevelChip hex={levels[i].hex} level={i + 1} />
                  </th>
                  {row.map((count, j) => {
                    const share = total ? count / total : 0;
                    const diag = i === j;
                    return (
                      <Tip
                        as="td"
                        key={j}
                        className="h-8 p-0"
                        tip={
                          <>
                            True MST {i + 1}, predicted MST {j + 1}
                            <br />
                            <span className="font-semibold tabular-nums">{count}</span> of {total} answered ({pct(share)})
                          </>
                        }
                      >
                        <span
                          className="flex h-full items-center justify-center rounded-[4px] tabular-nums"
                          style={{
                            background: count ? seq(share) : "rgba(98,91,107,0.05)",
                            color: count ? seqInk(share) : "transparent",
                            boxShadow: diag ? "inset 0 0 0 1.5px rgba(33,29,38,0.55)" : undefined,
                          }}
                        >
                          {count || "·"}
                        </span>
                      </Tip>
                    );
                  })}
                  <td className="pl-2 text-right tabular-nums text-text-muted">{pct(stat.rejection_rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-small text-text-muted">
        Rows are the true level, columns what the pipeline answered. Outlined cells are correct. Shade shows each
        cell&apos;s share of its row. {lightLabel}, white balance {wb}: {pct(cell.exact, 1)} exact and{" "}
        {pct(cell.within1, 1)} within one level of the photos it answered, average lean{" "}
        {(cell.mean_bias ?? 0) >= 0 ? "+" : ""}
        {(cell.mean_bias ?? 0).toFixed(2)} levels.
      </p>
    </div>
  );
}
