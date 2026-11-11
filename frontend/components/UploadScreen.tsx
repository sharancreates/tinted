"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Page } from "@/components/ui/Page";
import { Aura } from "@/components/ui/Aura";
import { pillClass } from "@/components/ui/PillGroup";
import CameraModal from "./CameraModal";
import { entranceGroup, entranceItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type BudgetValue = "drugstore" | "mid" | "high" | "all";
export type AnalyseMode = "normal" | "stream";

const BUDGET_OPTIONS: { label: string; sub: string; value: BudgetValue }[] = [
  { label: "Drugstore", sub: "under $20", value: "drugstore" },
  { label: "Mid-range", sub: "$20–60", value: "mid" },
  { label: "High-end", sub: "$60+", value: "high" },
  { label: "Everything", sub: "", value: "all" },
];

const MODES = [
  { value: "normal", label: "Just analyse" },
  { value: "stream", label: "Show the pipeline" },
] as const;

const TIPS = [
  { title: "Face the light", body: "A window beats a ceiling bulb. Avoid coloured light." },
  { title: "No filters", body: "Beauty modes change the very thing we measure." },
  { title: "Bare skin helps", body: "Foundation pulls the reading toward the shade you already wear." },
];

export default function UploadScreen({
  onUpload,
}: {
  onUpload: (file: File, budget: BudgetValue, mode: AnalyseMode) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const item = entranceItem(reduced);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [showCamera, setCamera] = useState(false);
  const [budget, setBudget] = useState<BudgetValue>("all");
  const [mode, setMode] = useState<AnalyseMode>("normal");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tinted_mode") as AnalyseMode | null;
      if (saved === "normal" || saved === "stream") setMode(saved);
    } catch {
      /* Storage unavailable; the default stands. */
    }
  }, []);

  const handleModeChange = useCallback((next: AnalyseMode) => {
    setMode(next);
    try {
      localStorage.setItem("tinted_mode", next);
    } catch {
      /* The choice just won't persist. */
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) onUpload(file, budget, mode);
    },
    [onUpload, budget, mode],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) onUpload(file, budget, mode);
    },
    [onUpload, budget, mode],
  );

  return (
    <Page width="grid">
      <motion.div
        variants={entranceGroup(reduced)}
        initial="hidden"
        animate="show"
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <motion.header variants={item} className="flex flex-col gap-2">
            <h1 className="text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
              Shade match
            </h1>
            <p className="max-w-prose text-text-soft">
              Upload a photo and we&apos;ll read your depth and undertone from your
              skin, then match you to real products.
            </p>
          </motion.header>

          {/* The whole tile is the button, so the main action works by
              keyboard and by drop. */}
          <motion.div variants={item}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "group block w-full cursor-pointer rounded-tile text-left shadow-card",
                "transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft)",
                "hover:-translate-y-0.5 hover:shadow-lift",
                isDragging && "-translate-y-0.5 shadow-lift ring-2 ring-accent-vivid ring-offset-4 ring-offset-transparent",
              )}
            >
              <Aura variant="match" className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
                <span className="glass-strong grid h-16 w-16 place-items-center rounded-full text-accent-vivid transition-[background-color,color] duration-(--duration-fast) group-hover:bg-accent-vivid group-hover:text-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17,8 12,3 7,8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                <span>
                  <span className="block text-title font-medium text-text">
                    {isDragging ? "Drop it here" : "Drop a photo, or browse"}
                  </span>
                  <span className="mt-1 block text-small text-text-soft">JPEG, PNG or WebP, up to 8 MB</span>
                </span>
              </Aura>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </motion.div>

          <motion.div variants={item} className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCamera(true)}
              className="glass-strong inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-pill px-5 text-small font-semibold text-text transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] text-accent-vivid" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Use camera
            </button>
            <Link
              href="/quiz"
              className="inline-flex min-h-11 items-center rounded-pill px-2 text-small font-medium text-accent underline-offset-4 hover:underline"
            >
              No camera? Take the skincare quiz
            </Link>
          </motion.div>

          <motion.div variants={item} className="glass flex flex-col gap-6 rounded-card p-6 md:p-8">
            <fieldset className="min-w-0">
              <legend className="text-label uppercase text-text-muted">Mode</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => handleModeChange(value)}
                    className={pillClass(mode === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-small text-text-muted">
                {mode === "stream"
                  ? "Watch each stage run: detection, quality check, sampling and classification."
                  : "Get the result in one step."}
              </p>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="text-label uppercase text-text-muted">Budget</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map(({ label, sub, value }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={budget === value}
                    onClick={() => setBudget(value)}
                    className={pillClass(budget === value)}
                  >
                    {label}
                    {sub && <span className="font-normal text-text-muted">{sub}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          </motion.div>
        </div>

        {/* Coaching before capture beats an error after it. */}
        <motion.aside
          variants={item}
          aria-labelledby="tips-heading"
          className="tone-panel dots flex flex-col gap-5 self-start rounded-card p-6"
        >
          <h2 id="tips-heading" className="text-label uppercase text-text-muted">
            For a good read
          </h2>
          <ul className="flex flex-col gap-4">
            {TIPS.map((tip) => (
              <li key={tip.title} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-vivid" />
                <div>
                  <p className="text-body font-semibold text-text">{tip.title}</p>
                  <p className="mt-0.5 text-small text-text-soft">{tip.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="glass-strong rounded-sm px-4 py-3 text-small text-text-soft">
            Your photo is analysed and discarded. We don&apos;t store it.
          </p>
        </motion.aside>
      </motion.div>

      {showCamera && (
        <CameraModal
          onCapture={(file) => {
            setCamera(false);
            onUpload(file, budget, mode);
          }}
          onClose={() => setCamera(false)}
        />
      )}
    </Page>
  );
}
