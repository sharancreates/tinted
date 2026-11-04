"use client";

import { useEffect, useId, useState } from "react";
import { FIELD } from "@/components/ui/field";
import { findProducts, type Product } from "@/lib/shades";

/**
 * Type a product, pick it from the catalogue. Also used by the photo and
 * barcode methods: they fill `initialQuery` with what they recognised and the
 * same list appears, so every method ends in one place.
 */
export function SearchMethod({ onPick, initialQuery = "" }: { onPick: (p: Product) => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Product[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const listId = useId();

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setStatus("idle");
      return;
    }
    let live = true;
    setStatus("loading");
    const t = setTimeout(async () => {
      try {
        const found = await findProducts(q);
        if (live) {
          setResults(found);
          setStatus("idle");
        }
      } catch {
        if (live) setStatus("error");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div>
      <label htmlFor={`${listId}-q`} className="sr-only">
        Product name
      </label>
      <input
        id={`${listId}-q`}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try “Fenty soft matte”"
        className={FIELD}
        aria-controls={listId}
      />
      <div id={listId} aria-live="polite" className="mt-3 min-h-6">
        {status === "loading" && <p className="px-2 text-small text-text-muted">Searching…</p>}
        {status === "error" && <p className="px-2 text-small text-danger">Search failed. Check your connection and try again.</p>}
        {status === "idle" && results?.length === 0 && (
          <p className="px-2 text-small text-text-muted">
            Not in the catalogue yet. Fenty Beauty Pro Filt&apos;r is the first product; more are coming.
          </p>
        )}
        {status === "idle" && results && results.length > 0 && (
          <ul className="grid gap-1.5">
            {results.map((p) => (
              <li key={`${p.brand}-${p.product_name}`}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center justify-between gap-3 rounded-tile px-4 py-3 text-left transition-colors duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-peach/70 focus-visible:bg-peach/70"
                >
                  <span>
                    <span className="block text-label uppercase text-text-muted">{p.brand}</span>
                    <span className="block font-medium text-text">{p.product_name}</span>
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-text-muted">{p.shades} shades</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
