"use client";

import { cn } from "@/lib/utils";
import {
  CATEGORY_LIFESPANS,
  categoryFamily,
  formatCents,
  PRODUCT_STATUS_LABELS,
  type CategoryFamily,
  type InventoryItem,
} from "@/lib/vanity";

/** Card ground per category family: face peach, skincare sage, lips blush, eyes lavender. */
const FAMILY_CARD: Record<CategoryFamily, string> = {
  face: "bg-peach",
  skincare: "bg-sage",
  lips: "bg-blush",
  eyes: "bg-lavender",
  other: "bg-[#fffdfa]",
};

/**
 * Status colour sits on a dot inside a white pill, so it reads on every card
 * ground and never competes with the category pastel.
 */
const STATUS_DOT: Record<string, string> = {
  using: "bg-accent-vivid",
  panning: "bg-success",
  wishlist: "bg-sky-ink",
  backup: "bg-text-muted",
  finished: "bg-line-strong",
  destash: "bg-danger",
};

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
  onOpen,
  activeId,
  flags = {},
}: {
  items: InventoryItem[];
  /** Tap toggles membership (the look editor). */
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (item: InventoryItem) => void;
  /** Tap opens the product's detail panel (the shelf). */
  onOpen?: (item: InventoryItem) => void;
  activeId?: string | null;
  flags?: Record<string, "low" | "empty">;
}) {
  if (items.length === 0) return null;

  return (
    // Columns follow the space the grid actually has, not the window, because
    // on the shelf a detail panel takes part of the width.
    <div className="@container">
    <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @xl:gap-4">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id) || activeId === item.id;
        const Interactive = selectable || onOpen ? "button" : "div";
        const family = categoryFamily(item.category);
        const lifespan = CATEGORY_LIFESPANS[item.category?.toLowerCase() ?? ""];
        const openedAt = item.opened_date ? Date.parse(`${item.opened_date}T00:00:00Z`) : NaN;
        const dueAt = Number.isFinite(openedAt) && lifespan ? openedAt + lifespan * 86_400_000 : NaN;
        const runningLowNudge = Number.isFinite(dueAt) && dueAt - Date.now() <= 14 * 86_400_000;

        return (
          <li key={item.id}>
            <Interactive
              {...(selectable
                ? {
                    type: "button" as const,
                    onClick: () => onToggle?.(item),
                    "aria-pressed": selected,
                  }
                : onOpen
                  ? {
                      type: "button" as const,
                      onClick: () => onOpen(item),
                      "aria-expanded": activeId === item.id,
                      "aria-label": `${item.brand} ${item.product}${item.shade ? `, ${item.shade}` : ""}: show details`,
                    }
                  : {})}
              className={cn(
                "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-card border p-2 text-left",
                "transition-[transform,box-shadow,border-color] duration-(--duration-fast) ease-(--ease-out-soft)",
                FAMILY_CARD[family],
                selected
                  ? "border-accent-vivid shadow-lift ring-2 ring-accent-vivid/30"
                  : "border-white/70 hover:shadow-lift motion-safe:hover:-translate-y-0.5",
                item.is_finished && "opacity-70",
              )}
            >
              {/* The shade, at a size that makes the shelf scannable by colour. */}
              <div
                className="relative h-28 w-full overflow-hidden rounded-tile bg-swatch-ground shadow-[inset_0_0_0_1px_rgba(43,36,32,0.05)]"
                style={item.hex && !item.image_url ? { backgroundColor: item.hex } : undefined}
              >
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt="" className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
                )}
                {!item.hex && !item.image_url && (
                  <span
                    className="flex h-full w-full items-center justify-center text-title font-semibold text-text-muted/40"
                    aria-hidden="true"
                  >
                    {item.brand.charAt(0).toUpperCase()}
                  </span>
                )}
                {flags[item.id] && (
                  <span className={`absolute left-2 top-2 rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold text-white ${flags[item.id] === "empty" ? "bg-danger" : "bg-warn"}`}>
                    {flags[item.id] === "empty" ? "Empty" : "Low"}
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

              <div className="flex flex-1 flex-col gap-0.5 px-2 pb-1.5 pt-3">
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
                {!selectable && (
                  <span className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-pill bg-white/85 px-2.5 py-1 text-[0.6875rem] font-semibold text-text shadow-[0_1px_2px_rgba(70,45,30,0.06)]">
                    <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[item.status] ?? STATUS_DOT.using)} />
                    {PRODUCT_STATUS_LABELS[item.status] ?? PRODUCT_STATUS_LABELS.using}
                  </span>
                )}
                {runningLowNudge && <p className="mt-1 text-label text-peach-ink">Running low?</p>}
              </div>
            </Interactive>

          </li>
        );
      })}
    </ul>
    </div>
  );
}
