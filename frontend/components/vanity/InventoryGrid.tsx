"use client";

import { cn } from "@/lib/utils";
import { formatCents, type InventoryItem } from "@/lib/vanity";

/**
 * A shelf of what you own.
 *
 * Colour-first on purpose: a vanity is recognised by its shades, not read as a
 * list of product names. The swatch is the largest element, the name is
 * secondary, and everything else is one line — which is also what stops this
 * becoming another wall of text.
 */
export function InventoryGrid({
  items,
  selectable = false,
  selectedIds = [],
  onToggle,
  onDelete,
}: {
  items: InventoryItem[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        const Interactive = selectable ? "button" : "div";

        return (
          <li key={item.id}>
            <Interactive
              {...(selectable
                ? {
                    type: "button" as const,
                    onClick: () => onToggle?.(item),
                    "aria-pressed": selected,
                  }
                : {})}
              className={cn(
                "group relative flex h-full w-full flex-col overflow-hidden rounded-card border text-left",
                "transition-all duration-(--duration-base) ease-(--ease-out-soft)",
                selected
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-line hover:border-line-strong hover:shadow-lift",
                item.is_finished ? "bg-raised opacity-70" : "bg-surface shadow-card",
              )}
            >
              {/* The shade, at a size that makes the shelf scannable by colour. */}
              <div
                className="relative h-24 w-full bg-swatch-ground"
                style={item.hex ? { backgroundColor: item.hex } : undefined}
              >
                {!item.hex && (
                  <span
                    className="flex h-full w-full items-center justify-center font-display text-title text-text-muted/40"
                    aria-hidden="true"
                  >
                    {item.brand.charAt(0).toUpperCase()}
                  </span>
                )}
                {selected && (
                  <span
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-bg"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-0.5 p-3">
                <p className="clamp-1 text-label uppercase text-text-muted">
                  {item.brand}
                </p>
                <p className="clamp-2 text-small font-medium leading-snug text-text">
                  {item.product}
                </p>
                <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
                  <span className="clamp-1 text-small text-text-soft">
                    {item.shade ?? item.category ?? ""}
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-text-muted">
                    {formatCents(item.price_cents, item.currency)}
                  </span>
                </div>
              </div>
            </Interactive>

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="mt-1 text-label uppercase text-text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
