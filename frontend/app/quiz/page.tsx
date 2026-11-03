"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Page } from "@/components/ui/Page";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Orb } from "@/components/ui/Orb";
import { Aura } from "@/components/ui/Aura";
import { pillClass } from "@/components/ui/PillGroup";
import { EASE } from "@/lib/motion";
import { QuestionStep } from "@/components/quiz/QuestionStep";
import { RoutineResults } from "@/components/quiz/RoutineResults";
import {
  ApiError,
  fetchQuizQuestions,
  submitQuiz,
  type QuizAnswers,
  type QuizQuestion,
  type QuizResponse,
} from "@/lib/api";

type Phase = "loading" | "questions" | "submitting" | "results" | "error";

const BUDGETS = [
  { value: "all", label: "Any price" },
  { value: "drugstore", label: "Under $20" },
  { value: "mid", label: "$20 to $60" },
  { value: "high", label: "Premium" },
];

export default function QuizPage() {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [budget, setBudget] = useState("all");
  const [result, setResult] = useState<QuizResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Focus target for each new question. Without this, advancing a step leaves
  // screen-reader focus stranded on the button that just disappeared.
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuizQuestions()
      .then(({ questions }) => {
        if (cancelled) return;
        setQuestions(questions);
        setPhase("questions");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrors(
          error instanceof ApiError
            ? error.reasons
            : ["Couldn't load the quiz. Please refresh."],
        );
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase === "questions") headingRef.current?.focus();
  }, [index, phase]);

  const question = questions[index];
  const selected = question
    ? ((): string[] => {
        const value = answers[question.id];
        if (Array.isArray(value)) return value;
        return typeof value === "string" ? [value] : [];
      })()
    : [];

  const submit = useCallback(
    async (finalAnswers: QuizAnswers) => {
      setPhase("submitting");
      try {
        setResult(await submitQuiz(finalAnswers, budget));
        setPhase("results");
      } catch (error: unknown) {
        setErrors(
          error instanceof ApiError
            ? error.reasons
            : ["Something went wrong. Please try again."],
        );
        setPhase("error");
      }
    },
    [budget],
  );

  const advance = useCallback(
    (next: QuizAnswers) => {
      if (index < questions.length - 1) setIndex(index + 1);
      else void submit(next);
    },
    [index, questions.length, submit],
  );

  const handleSelect = (value: string) => {
    if (!question) return;

    if (question.multi) {
      // Toggle within the current selection; never auto-advance, since there's
      // no way to know the user has finished picking.
      const current = Array.isArray(answers[question.id])
        ? (answers[question.id] as string[])
        : [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [question.id]: next });
      return;
    }

    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    advance(next);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <Page width="grid">
        <div className="h-10 w-64 animate-pulse rounded-pill bg-raised" aria-busy="true" />
        <div className="mt-8 h-96 animate-pulse rounded-card bg-raised xl:mr-[344px]" />
      </Page>
    );
  }

  if (phase === "error") {
    return (
      <Page width="prose">
        <div className="glass flex flex-col gap-4 rounded-card p-8">
          <p className="text-label uppercase text-danger">Something went wrong</p>
          <h1 className="text-display font-semibold text-text">That didn&apos;t work</h1>
          <ul className="space-y-2" role="alert">
            {errors.map((message) => (
              <li key={message} className="text-text-soft">{message}</li>
            ))}
          </ul>
          <div>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        </div>
      </Page>
    );
  }

  if (phase === "submitting") {
    return (
      <Page width="prose" className="md:pt-20">
        <div className="flex flex-col items-center gap-5 text-center">
          <Orb size="xl" settle />
          <h1 className="text-display font-semibold text-text" role="status" aria-live="polite">
            Building your routine
          </h1>
          <p className="text-small text-text-muted">
            Matching {Object.keys(answers).length} answers against product tags.
          </p>
        </div>
      </Page>
    );
  }

  if (phase === "results" && result) {
    return (
      <RoutineResults
        data={result}
        onRestart={() => {
          setAnswers({});
          setIndex(0);
          setResult(null);
          setPhase("questions");
        }}
      />
    );
  }

  if (!question) return null;

  const isLast = index === questions.length - 1;
  const canContinue = !question.multi || selected.length > 0;

  return (
    <Page width="grid">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PageHeader
            className="mb-0"
            label="Skincare quiz"
            title="A routine in a minute."
            description="Answer a few questions about your skin and we'll put together a routine, in the order you apply it."
          />

          <div className="glass rounded-card p-5 md:p-8">
            <ProgressBar current={index + 1} total={questions.length} className="mb-8" />

            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.36, ease: EASE }}
              >
                {/* tabIndex -1 makes this programmatically focusable so each new
                    question is announced. */}
                <div ref={headingRef} tabIndex={-1} className="outline-none">
                  <QuestionStep
                    question={question}
                    selected={selected}
                    onSelect={handleSelect}
                  />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line-strong pt-6">
              <Button
                variant="ghost"
                onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}
              >
                Back
              </Button>

              {/* Single-select advances on tap, so a continue button would be dead
                  weight. It only appears where it does something. */}
              {question.multi ? (
                <Button onClick={() => advance(answers)} disabled={!canContinue}>
                  {isLast ? "See my routine" : "Continue"}
                </Button>
              ) : (
                <p className="text-small text-text-muted">Pick one to continue</p>
              )}
            </div>
          </div>
        </div>

        {/* Budget lives beside the questions so it can be set at any point,
            not only on the last step. */}
        <aside aria-labelledby="quiz-side-heading" className="tone-panel dots flex flex-col gap-5 self-start rounded-card p-4">
          <Aura variant="quiz" className="flex min-h-36 items-end p-5">
            <h2 id="quiz-side-heading" className="text-heading font-semibold text-text">
              {questions.length} questions
            </h2>
          </Aura>
          <fieldset className="min-w-0 px-2">
            <legend className="text-label uppercase text-text-muted">Budget</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {BUDGETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={budget === option.value}
                  onClick={() => setBudget(option.value)}
                  className={pillClass(budget === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="glass-strong mx-2 mb-2 rounded-sm px-4 py-3 text-small text-text-soft">
            No account needed. Sign in afterwards if you want to save the routine.
          </p>
        </aside>
      </div>
    </Page>
  );
}
