"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/api";

/**
 * One question, one screen.
 *
 * Single-select advances on click — an extra "next" tap per question is pure
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
  return (
    <div>
      <h1 className="font-display text-title text-text">{question.prompt}</h1>
      {question.help_text && (
        <p className="mt-2 text-small text-text-muted">{question.help_text}</p>
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className={cn(
                "flex min-h-14 flex-col justify-center rounded-card border p-4 text-left",
                "transition-colors duration-(--duration-fast)",
                isSelected
                  ? "border-accent bg-accent-dim"
                  : "border-line bg-surface hover:border-line-strong hover:bg-raised",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center border",
                    question.multi ? "rounded-[0.3rem]" : "rounded-full",
                    isSelected
                      ? "border-accent bg-accent text-bg"
                      : "border-line-strong",
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
