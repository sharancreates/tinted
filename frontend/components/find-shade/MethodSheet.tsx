"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { pillClass } from "@/components/ui/PillGroup";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type Method = { key: string; label: string; icon: React.ReactNode; panel: React.ReactNode };

/**
 * A bottom sheet holding the ways to name a product. It docks to the bottom of
 * the viewport (above the phone tab bar), opens to show the chosen method,
 * and folds to a single bar once there is a result to look at.
 */
export function MethodSheet({
  methods,
  open,
  onOpenChange,
  summary,
}: {
  methods: Method[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown on the folded bar. */
  summary: string;
}) {
  const [active, setActive] = useState(methods[0].key);
  const reduced = useReducedMotion() ?? false;
  const current = methods.find((m) => m.key === active) ?? methods[0];

  return (
    <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 mt-10 lg:bottom-6">
      <section
        aria-label="Find a product"
        className="mx-auto max-w-2xl rounded-window border border-line bg-raised/95 shadow-lift backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex w-full flex-col items-center gap-2 rounded-t-window px-6 pb-3 pt-2.5"
        >
          <span aria-hidden="true" className="h-1.5 w-10 rounded-pill bg-line-strong" />
          <span className="flex w-full items-center justify-between gap-3">
            <span className="font-display text-[1.25rem] font-semibold text-text">{open ? "Find a product" : summary}</span>
            <span className="text-small font-semibold text-accent">{open ? "Fold" : "Change"}</span>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduced ? DURATION.reduced : DURATION.base, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6">
                <div role="tablist" aria-label="How to find it" className="mb-4 flex flex-wrap gap-1.5">
                  {methods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="tab"
                      id={`method-tab-${m.key}`}
                      aria-selected={active === m.key}
                      aria-controls={`method-panel-${m.key}`}
                      onClick={() => setActive(m.key)}
                      className={cn(pillClass(active === m.key, "min-h-10 px-4"))}
                    >
                      {m.icon}
                      {m.label}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`method-panel-${current.key}`} aria-labelledby={`method-tab-${current.key}`}>
                  {current.panel}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
