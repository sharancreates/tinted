"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  /** Optional count shown after the label, e.g. product totals. */
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. Required — "Tabs" tells a user nothing. */
  label: string;
  className?: string;
}

/**
 * A tablist implementing the APG keyboard pattern: arrow keys move between
 * tabs, Home/End jump to the ends, and only the active tab is in the tab order
 * (roving tabindex) so Tab moves past the group rather than through every tab.
 */
export function Tabs({ tabs, activeId, onChange, label, className }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const wrapped = (index + tabs.length) % tabs.length;
    onChange(tabs[wrapped].id);
    refs.current[wrapped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, () => void> = {
      ArrowRight: () => focusTab(index + 1),
      ArrowLeft: () => focusTab(index - 1),
      Home: () => focusTab(0),
      End: () => focusTab(tabs.length - 1),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        // Was a wrapping pill: at 10 categories it broke onto a second row and
        // the rounded container sheared around the selected tab. A single
        // scrolling row keeps the shape intact at any count.
        "glass flex max-w-full items-center gap-1 overflow-x-auto rounded-pill p-1.5",
        "no-scrollbar fade-edges",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap rounded-pill px-4 text-small font-semibold",
              "transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-(--ease-out-soft)",
              selected
                ? "bg-white text-text shadow-card"
                : "text-text-soft hover:bg-white/50 hover:text-text",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  selected ? "text-accent" : "text-text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
