"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, identifyProduct } from "@/lib/api";
import { productQuery, type Product } from "@/lib/shades";
import { SearchMethod } from "./SearchMethod";

/**
 * Photograph the packaging; Claude reads the brand and product name, and the
 * result drops into the normal catalogue search so the user confirms the
 * match with one tap. The photo goes to the server once and is not kept.
 */
export function PhotoMethod({ onPick }: { onPick: (p: Product) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "none" | "error">("idle");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const read = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setStatus("reading");
    setQuery("");
    try {
      const { product } = await identifyProduct(file);
      if (!product) {
        setStatus("none");
        return;
      }
      setQuery(productQuery(product.brand, product.product_name));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof ApiError ? e.reasons[0] : "Couldn't read that photo. Try again.");
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="group relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-tile border-2 border-dashed border-peach-mid bg-peach/50 text-peach-ink transition-colors duration-(--duration-fast) hover:bg-peach"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your product photo" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          <span className="sr-only">{preview ? "Take another photo" : "Take or choose a photo"}</span>
        </button>
        <div className="text-small">
          <p className="font-semibold text-text">{preview ? "Tap the photo to try another" : "Photograph the bottle or box"}</p>
          <p className="mt-0.5 text-text-muted">
            {status === "reading" ? "Reading the label…" : "The name on the front is enough. The photo isn't stored."}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file);
            e.target.value = "";
          }}
        />
      </div>

      {status === "none" && (
        <p className="rounded-tile bg-blush px-4 py-3 text-small text-blush-ink">
          Couldn&apos;t make out a product name. Try a closer, straighter photo of the front, or search by name.
        </p>
      )}
      {status === "error" && <p className="rounded-tile bg-blush px-4 py-3 text-small text-blush-ink">{error}</p>}
      {query && (
        <div>
          <p className="mb-2 text-small text-text-soft">
            Read as <span className="font-semibold text-text">{query}</span>. Pick the match:
          </p>
          <SearchMethod onPick={onPick} initialQuery={query} />
        </div>
      )}
    </div>
  );
}
