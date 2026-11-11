"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE, STAGGER } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/api";

/**
 * One question, one screen.
 *
 * Single-select advances on click: an extra "next" tap per question is pure
 * friction. Multi-select can't, since there is no way to know the user is done
 * picking, so it gets an explicit continue button from the parent.
 */
export function QuestionStep({
  question,
  selected,
  onSelect,
}: {
  question: QuizQuestion;
  selected: string[];
  onSelect: (value: string) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div>
      <h2 className="text-display font-semibold text-text">{question.prompt}</h2>
      {question.help_text && (
        <p className="mt-2 text-text-soft">{question.help_text}</p>
      )}

      <div
        // Multi-select is a group of independent toggles, which is what a
        // checkbox group is. Single-select is a radiogroup.
        role={question.multi ? "group" : "radiogroup"}
        aria-label={question.prompt}
        className="mt-6 grid gap-2 sm:grid-cols-2"
      >
        {question.options.map((option, index) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              type="button"
              role={question.multi ? "checkbox" : "radio"}
              aria-checked={isSelected}
              onClick={() => onSelect(option.value)}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : index * STAGGER, duration: reduced ? DURATION.reduced : DURATION.base, ease: EASE }}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col justify-center rounded-tile border p-4 text-left",
                "transition-[transform,box-shadow,background-color,border-color] duration-(--duration-fast) ease-(--ease-out-soft)",
                isSelected
                  ? "border-accent-vivid bg-raised shadow-lift"
                  : "border-line bg-surface/70 shadow-card hover:-translate-y-0.5 hover:bg-surface hover:shadow-lift",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center border",
                    question.multi ? "rounded-[0.3rem]" : "rounded-full",
                    "transition-colors duration-(--duration-fast)",
                    isSelected
                      ? "border-accent bg-accent text-bg"
                      : "border-line-strong bg-surface",
                  )}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-current stroke-2">
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="font-medium text-text">{option.label}</span>
              </span>
              {option.hint && (
                <span className="mt-1 pl-[1.9rem] text-small text-text-muted">
                  {option.hint}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
