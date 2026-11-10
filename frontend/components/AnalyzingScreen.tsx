"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Page } from "@/components/ui/Page";
import { Orb } from "@/components/ui/Orb";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { Button } from "@/components/ui/Button";
import { entranceGroup, entranceItem } from "@/lib/motion";

// What the pipeline does, in order. Shown as a description, not live status:
// /analyze is a single request, so the client cannot know which stage is
// running. "Show the pipeline" mode (/analyze-stream) has real per-stage
// feedback.
const PIPELINE = [
  "Correcting white balance",
  "Locating 468 facial landmarks",
  "Checking blur, exposure and head angle",
  "Sampling skin patches, discarding outliers",
  "Classifying depth and undertone",
  "Matching against the shade catalogue",
];

export default function AnalyzingScreen({
  qualityErrors,
  onReset,
}: {
  qualityErrors: string[] | null;
  onReset: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const item = entranceItem(reduced);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (qualityErrors) return;
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [qualityErrors]);

  if (qualityErrors) {
    return (
      <Page width="prose">
        <motion.div
          variants={entranceGroup(reduced)}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-6"
        >
          <motion.header variants={item} className="flex flex-col gap-2">
            <p className="text-label uppercase text-warn">That photo won&apos;t give a good read</p>
            <h1 className="text-[clamp(2rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em] text-text">
              Let&apos;s try another
            </h1>
          </motion.header>

          {/* role="alert" so the reasons are announced. */}
          <motion.ul variants={item} className="glass flex flex-col gap-3 rounded-card p-6" role="alert">
            {qualityErrors.map((error) => (
              <li key={error} className="flex gap-3 text-text">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-warn" />
                {error}
              </li>
            ))}
          </motion.ul>

          <motion.p variants={item} className="text-small text-text-soft">
            We check before analysing, because a confidently wrong shade is worse
            than asking for a second photo.
          </motion.p>

          <motion.div variants={item}>
            <Button onClick={onReset}>Try another photo</Button>
          </motion.div>
        </motion.div>
      </Page>
    );
  }

  return (
    <Page width="prose">
      <motion.div
        variants={entranceGroup(reduced)}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-6 text-center"
      >
        <motion.div variants={item}>
          <Orb size="xl" />
        </motion.div>
        <motion.div variants={item} className="flex flex-col gap-2">
          <h1
            className="text-[clamp(2rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em] text-text"
            role="status"
            aria-live="polite"
          >
            Reading your skin tone
          </h1>
          <p className="text-small text-text-soft">
            {seconds >= 25
              ? "Taking longer than usual. The server may be waking up; still going."
              : "Usually 10 to 20 seconds."}
          </p>
        </motion.div>

        <motion.div variants={item} className="w-full">
          <ToneRibbon />
        </motion.div>

        <motion.div variants={item} className="glass w-full rounded-card p-6 text-left">
          <h2 className="text-label uppercase text-text-muted">What&apos;s happening</h2>
          <ol className="mt-4 flex flex-col gap-2.5">
            {PIPELINE.map((step) => (
              <li key={step} className="flex items-start gap-3 text-small text-text-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-vivid/60" aria-hidden="true" />
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-line-strong pt-4 text-small text-text-muted">
            Want to watch it happen? Choose <span className="font-medium text-text">Show the pipeline</span> on
            the upload screen.
          </p>
        </motion.div>
      </motion.div>
    </Page>
  );
}
