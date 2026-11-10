"use client";

import { motion } from "framer-motion";
import { Page } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddRecommendationToShelf } from "@/components/vanity/AddRecommendationToShelf";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { addRoutineSteps, getOrCreateSkincareRoutine, listRoutineSteps } from "@/lib/vanity";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { QuizResponse } from "@/lib/api";

const TAG_LABELS: Record<string, string> = {
  hydrating: "Hydration",
  brightening: "Brightening",
  exfoliating: "Exfoliation",
  gentle: "Gentle formulas",
  "oil-control": "Oil control",
  "anti-aging": "Anti-ageing",
  "barrier-repair": "Barrier repair",
  spf: "Sun protection",
  calming: "Calming",
  "acne-fighting": "Breakout control",
  "pore-refining": "Pore refining",
};

export function RoutineResults({
  data,
  onRestart,
}: {
  data: QuizResponse;
  onRestart: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [saveProblem, setSaveProblem] = useState("");
  const { profile, routine, routine_steps } = data;
  const byStep = new Map(routine.map((item) => [item.step, item]));

  const saveRoutine = async () => {
    if (!user) { setAuthOpen(true); return; }
    setSavingRoutine(true);
    setSaveProblem("");
    try {
      const target = await getOrCreateSkincareRoutine("morning", user.id);
      const existing = await listRoutineSteps(target.id);
      if (existing.length === 0) {
        await addRoutineSteps(target.id, routine_steps);
      }
      router.push("/routine");
    } catch { setSaveProblem("Couldn't save this routine. Please try again."); }
    finally { setSavingRoutine(false); }
  };

  return (
    <Page width="list">
      <PageHeader
        label="Your routine"
        title={`${routine_steps.length} steps, in order`}
        description="Built from your answers. Apply them top to bottom: the order matters more than any single product does."
      >
        <div className="flex flex-wrap gap-2">
          {profile.sensitive && (
            <Badge tone="warn">Reactive skin, no strong actives</Badge>
          )}
          {profile.beginner && <Badge tone="neutral">Beginner-friendly</Badge>}
          {profile.top_tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="accent">
              {TAG_LABELS[tag] ?? tag}
            </Badge>
          ))}
        </div>
      </PageHeader>

      {/* Why these priorities — the "we picked this because you said..."
          pattern, applied to the profile rather than to each product. */}
      {Object.keys(profile.rationale).length > 0 && (
        <Card className="mb-8" padding="md">
          <h2 className="text-heading font-semibold text-text">
            Why this routine
          </h2>
          <ul className="mt-3 space-y-2">
            {profile.top_tags
              .filter((tag) => profile.rationale[tag]?.length)
              .map((tag) => (
                <li key={tag} className="text-small text-text-soft">
                  <span className="font-medium text-text">
                    {TAG_LABELS[tag] ?? tag}
                  </span>
                  , because you said{" "}
                  <span className="text-text">
                    {profile.rationale[tag].join(", ").toLowerCase()}
                  </span>
                  .
                </li>
              ))}
          </ul>
        </Card>
      )}

      <ol className="space-y-3">
        {routine_steps.map((step, index) => {
          const item = byStep.get(step);
          return (
            <motion.li
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card padding="md" className="flex gap-4">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    "bg-accent-dim text-small font-semibold text-accent",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-label uppercase text-text-muted">
                      Step {index + 1} · {step}
                    </h3>
                    {item?.when && <Badge tone="neutral">{item.when}</Badge>}
                  </div>

                  {item ? (
                    <>
                      <p className="mt-1.5 font-medium text-text">
                        {item.brand} {item.product}
                      </p>
                      {item.key_ingredient && (
                        <p className="mt-0.5 text-small text-accent">
                          {item.key_ingredient}
                        </p>
                      )}
                      {item.why && (
                        <p className="mt-2 text-small leading-relaxed text-text-soft">
                          {item.why}
                        </p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center gap-1 text-small font-medium text-accent hover:text-accent"
                        >
                          Shop this
                          <span aria-hidden="true">→</span>
                        </a>
                      )}
                      <div className="mt-3 max-w-44">
                        <AddRecommendationToShelf
                          brand={item.brand}
                          product={item.product}
                          category={step}
                        />
                      </div>
                    </>
                  ) : (
                    // The skeleton renders even when product selection failed,
                    // so the user still learns what the step should be.
                    <p className="mt-1.5 text-small text-text-muted">
                      We couldn&apos;t load a product for this step, but keep
                      the step in your routine.
                    </p>
                  )}
                </div>

                {item?.price_range && (
                  <span className="self-start text-small text-text-muted">
                    {item.price_range}
                  </span>
                )}
              </Card>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => void saveRoutine()} disabled={savingRoutine}>
          {savingRoutine ? "Saving routine…" : "Save as my morning routine"}
        </Button>
        <Button variant="secondary" onClick={onRestart}>
          Retake the quiz
        </Button>
      </div>
      {saveProblem && <p className="mt-3 text-small text-danger" role="alert">{saveProblem}</p>}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      <p className="mt-8 text-small text-text-muted">
        Skincare advice here is generated, not medical. Patch-test new actives,
        introduce one at a time, and see a dermatologist for persistent
        conditions.
      </p>
    </Page>
  );
}
