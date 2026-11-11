"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { fetchProductImages, imageKey, lookupProducts, type ProductMatch, type ProductShade } from "@/lib/api";
import { ShadePicker } from "@/components/vanity/ShadePicker";
import {
  addInventoryItem,
  formatCents,
  parsePriceToCents,
  type InventoryItem,
} from "@/lib/vanity";

const CATEGORIES = [
  "foundation", "concealer", "moisturizer", "cleanser", "serum", "sunscreen",
  "primer", "blush", "bronzer", "highlighter", "eyeshadow", "mascara",
  "lipstick", "lip_gloss", "setting_spray", "toner", "exfoliant", "eye_cream",
  "body_lotion", "other", "lip", "setting powder", "brow", "skincare",
];

import { FIELD } from "@/components/ui/field";

/**
 * Search-first product entry.
 *
 * Adding something you already own should not require filling six fields. You
 * type what you'd say out loud — "elf halo glow" — pick from matches, and the
 * details fill in. The form still exists underneath, pre-filled and editable,
 * because the match is a suggestion and you are the authority on what is
 * actually on your shelf.
 */
export function AddProduct({
  userId,
  onAdded,
}: {
  userId: string;
  onAdded: (item: InventoryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Chosen or manually entered product.
  const [draft, setDraft] = useState<ProductMatch | null>(null);
  const [shade, setShade] = useState<ProductShade | null>(null);
  const [priceText, setPriceText] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Guards against a slow earlier request landing after a newer one and
  // replacing good results with stale ones.
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || draft) {
      setMatches([]);
      setSearched(false);
      return;
    }
    const ticket = ++latest.current;
    setSearching(true);
    // Long enough that typing a product name is one request, not eight.
    const timer = setTimeout(() => {
      lookupProducts(trimmed)
        .then(({ results }) => {
          if (ticket !== latest.current) return;
          setMatches(results);
          setSearched(true);
        })
        .catch(() => {
          if (ticket === latest.current) setMatches([]);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [query, draft]);

  const choose = (match: ProductMatch) => {
    setDraft(match);
    setShade(null);
    setPriceText(match.price_cents !== null ? (match.price_cents / 100).toFixed(2) : "");
    setMatches([]);
  };

  const startManual = () => {
    const [brand = "", ...rest] = query.trim().split(" ");
    setDraft({
      brand,
      product: rest.join(" "),
      category: null,
      shade: null,
      hex: null,
      price_cents: null,
    });
    setShade(null);
    setPriceText("");
    setMatches([]);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.brand.trim() || !draft.product.trim()) {
      setProblem("Brand and product are both needed.");
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      let imageUrl: string | null = null;
      try {
        const response = await fetchProductImages([{ brand: draft.brand.trim(), product: draft.product.trim() }]);
        imageUrl = response.images[imageKey(draft.brand, draft.product)] ?? null;
      } catch {
        // Product photos are optional; the shelf keeps its category fallback.
      }
      const created = await addInventoryItem(
        {
          brand: draft.brand.trim(),
          product: draft.product.trim(),
          shade: shade?.name.trim() || null,
          // The picked shade's colour wins: it is the swatch for the exact
          // shade, where draft.hex would only be the product's general tone.
          category: draft.category,
          hex: shade?.hex ?? draft.hex,
          url: null,
          price_cents: parsePriceToCents(priceText),
          notes: null,
          image_url: imageUrl,
        },
        userId,
      );
      onAdded(created);
      setQuery("");
      setDraft(null);
      setShade(null);
      setPriceText("");
      setSearched(false);
    } catch {
      setProblem("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <div className="glass mb-5 rounded-card p-5 md:p-6">
        <label htmlFor="product-search" className="text-label uppercase text-text-muted">
          Search for a product you own
        </label>
        <div className="relative mt-2">
          <input
            id="product-search"
            className={FIELD}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="elf halo glow"
            autoFocus
            autoComplete="off"
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="product-matches"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-small text-text-muted">
              Searching…
            </span>
          )}
        </div>

        {matches.length > 0 && (
          <ul id="product-matches" className="mt-3 space-y-1.5">
            {matches.map((match, index) => (
              <li key={`${match.brand}-${match.product}-${index}`}>
                <button
                  type="button"
                  onClick={() => choose(match)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-tile border border-line bg-raised/60 p-3 text-left",
                    "transition-[background-color,border-color] duration-(--duration-fast) hover:border-accent-vivid hover:bg-raised",
                  )}
                >
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border border-line-strong"
                    style={{ backgroundColor: match.hex ?? "var(--color-raised)" }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-label uppercase text-text-muted">
                      {match.brand}
                    </span>
                    <span className="block clamp-1 font-medium text-text">
                      {match.product}
                    </span>
                    {(match.shade || match.category) && (
                      <span className="block text-small text-text-soft">
                        {[match.shade, match.category].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-small tabular-nums text-text-muted">
                    {formatCents(match.price_cents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {searched && matches.length === 0 && !searching && (
          <p className="mt-3 text-small text-text-muted">
            No matches for that.{" "}
            <button
              type="button"
              onClick={startManual}
              className="font-medium text-accent hover:underline"
            >
              Add it manually
            </button>
          </p>
        )}

        {!searched && (
          <p className="mt-3 text-small text-text-muted">
            Type a brand and product. Spelling doesn&apos;t have to be exact.{" "}
            <button
              type="button"
              onClick={startManual}
              className="font-medium text-accent hover:underline"
            >
              Or enter it manually
            </button>
          </p>
        )}
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  return (
    <form onSubmit={save} className="glass mb-5 rounded-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-label uppercase text-accent">Check and add</p>
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-text-muted hover:text-text"
        >
          <span aria-hidden="true">←</span> Search again
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-label uppercase text-text-muted">Brand</span>
          <input
            className={`mt-2 ${FIELD}`}
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-label uppercase text-text-muted">Product</span>
          <input
            className={`mt-2 ${FIELD}`}
            value={draft.product}
            onChange={(e) => setDraft({ ...draft, product: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-label uppercase text-text-muted">Category</span>
          <select
            className={`mt-2 ${FIELD}`}
            value={draft.category ?? ""}
            onChange={(e) => setDraft({ ...draft, category: e.target.value || null })}
          >
            <option value="">Not sure</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-label uppercase text-text-muted">
            Price{" "}
            {draft.price_cents !== null && (
              <span className="normal-case tracking-normal">(estimate, check it)</span>
            )}
          </span>
          <input
            className={`mt-2 ${FIELD}`}
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="42.00"
            inputMode="decimal"
          />
        </label>
      </div>

      {/* Shades come from the product's own range, so they are recognised by
          colour rather than recalled by name. */}
      <div className="mt-4 border-t border-line pt-4">
        <ShadePicker
          brand={draft.brand}
          product={draft.product}
          selected={shade}
          onSelect={setShade}
        />
      </div>

      {problem && (
        <p className="mt-3 text-small text-danger" role="alert">
          {problem}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add to shelf"}
        </Button>
        <span className="text-small text-text-muted">
          Prices are typical retail, not live. Edit anything that&apos;s off.
        </span>
      </div>
    </form>
  );
}
