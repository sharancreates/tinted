"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FIELD } from "@/components/ui/field";
import { lookupShades, type ProductShade } from "@/lib/api";

/**
 * Pick a shade from the product's actual range.
 *
 * Searching by shade name never worked, because shade names are local to their
 * product — "Deauville" is unfindable unless you already know it is NARS Sheer
 * Glow. So the product is chosen first and its range is fetched, which also
 * means the user recognises their shade by colour instead of recalling a name.
 */
export function ShadePicker({
  brand,
  product,
  selected,
  onSelect,
}: {
  brand: string;
  product: string;
  selected: ProductShade | null;
  onSelect: (shade: ProductShade | null) => void;
}) {
  const [shades, setShades] = useState<ProductShade[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    lookupShades(brand, product)
      .then(({ shades }) => {
        if (cancelled) return;
        setShades(shades);
        setState(shades.length ? "ready" : "none");
      })
      .catch(() => !cancelled && setState("none"));
    return () => {
      cancelled = true;
    };
  }, [brand, product]);

  if (state === "loading") {
    return (
      <div aria-busy="true">
        <p className="text-label uppercase text-text-muted">Shades</p>
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      </div>
    );
  }

  // Products without a range (mascara, a clear balm) and products we simply
  // don't know. Either way the user types it, rather than being blocked.
  if (state === "none") {
    return (
      <label className="block">
        <span className="text-label uppercase text-text-muted">Shade</span>
        <input
          className={`mt-2 ${FIELD}`}
          value={selected?.name ?? ""}
          onChange={(event) =>
            onSelect(
              event.target.value
                ? { name: event.target.value, hex: selected?.hex ?? null, undertone: null }
                : null,
            )
          }
          placeholder="Type the shade, or leave blank"
        />
        <span className="mt-1 block text-small text-text-muted">
          We don&apos;t have a shade list for this one.
        </span>
      </label>
    );
  }

  const term = filter.trim().toLowerCase();
  const visible = term
    ? shades.filter((s) => s.name.toLowerCase().includes(term))
    : shades;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-label uppercase text-text-muted">
          Shades <span className="text-text-soft">({shades.length})</span>
        </p>
        {shades.length > 12 && (
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter"
            className="min-h-9 rounded-pill border border-line bg-surface px-3 text-small text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
            aria-label="Filter shades"
          />
        )}
      </div>

      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {visible.map((shade) => {
          const isSelected = selected?.name === shade.name;
          return (
            <li key={shade.name}>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : shade)}
                aria-pressed={isSelected}
                className={cn(
                  "flex w-full flex-col overflow-hidden rounded-card border text-left",
                  "transition-all duration-(--duration-fast)",
                  isSelected
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-line hover:border-line-strong hover:shadow-card",
                )}
              >
                <span
                  className="block h-12 w-full"
                  style={{ backgroundColor: shade.hex ?? "var(--color-raised)" }}
                  aria-hidden="true"
                />
                {/* The name is always spelled out — a grid of colour alone is
                    unusable for anyone matching a shade by its label. */}
                <span className="block truncate px-2 py-1.5 text-small text-text">
                  {shade.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="mt-3 text-small text-text-muted">
          No shade matches &ldquo;{filter}&rdquo;.
        </p>
      )}

      <button
        type="button"
        onClick={() => onSelect(null)}
        className="mt-3 text-small text-text-muted hover:text-text"
      >
        Skip, I don&apos;t know the shade
      </button>
    </div>
  );
}
