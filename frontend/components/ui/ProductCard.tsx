"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Product {
  brand: string;
  product: string;
  shade?: string;
  price_range?: string;
  why?: string;
  url?: string;
  /** Resolved separately via POST /product-images; undefined = still loading. */
  imageUrl?: string | null;
  /** Swatch colour, when the product maps to a known hex. */
  hex?: string;
}

/**
 * A recommendation card.
 *
 * Two things drive the layout:
 *
 * 1. **A missing photo is normal, not exceptional.** Image search fails often
 *    enough that the no-photo state has to look deliberate. The previous
 *    checkerboard read as a broken asset; this uses a tonal panel with the
 *    brand monogram, which looks like a choice.
 *
 * 2. **Cards must agree on height.** Blurb length varies, which left rows with
 *    ragged bottoms. The card is a flex column with a clamped blurb and the
 *    meta row pinned to the bottom, so a row reads as a row.
 */
export function ProductCard({
  product,
  /** Position in the grid. Kept for callers; no longer affects styling. */
  index = 0,
  className,
}: {
  product: Product;
  index?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !failed;
  // Loading is per-card, not per-batch. A single batch flag meant all 27 cards
  // shimmered until the slowest lookup finished, which read as an empty grid.
  // undefined = not resolved yet; null = resolved to no photo.
  const imageLoading = product.imageUrl === undefined && !failed;
  const hasShade = Boolean(product.shade && product.shade !== "N/A");
  const monogram = (product.brand || product.product).charAt(0).toUpperCase();

  const interactive = Boolean(product.url);
  const Wrapper = interactive ? "a" : "div";
  const wrapperProps = interactive
    ? { href: product.url, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        // Solid white, never glass: product photos are colour being judged.
        "group flex h-full flex-col overflow-hidden rounded-tile",
        "border-4 border-white bg-swatch-ground shadow-card",
        interactive && [
          "transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft)",
          "hover:-translate-y-0.5 hover:shadow-lift",
        ],
        className,
      )}
    >
      {/* 4:5 rather than square: it fits more of a grid on screen at once, and
          most product photography is portrait anyway. */}
      <div className="relative aspect-4/5 overflow-hidden bg-swatch-ground">
        {showImage ? (
          // Plain <img>: sources are arbitrary third-party hosts from an image
          // search, which next/image can't optimise without allow-listing every
          // domain up front.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl as string}
            alt={`${product.brand ? product.brand + " " : ""}${product.product}${
              hasShade ? ` in shade ${product.shade}` : ""
            }`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-contain p-4 mix-blend-multiply"
          />
        ) : imageLoading ? (
          <div className="absolute inset-0 overflow-hidden bg-mst-1/60" aria-busy="true">
          </div>
        ) : (
          // No trustworthy photo: a designed placeholder rather than a gap. We
          // would rather show this than someone else's product.
          <div
            className="aura aura-looks aura-thumb flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center"
            aria-hidden="true"
          >
            {product.hex ? (
              <span
                className="h-16 w-16 rounded-full shadow-card ring-4 ring-white"
                style={{ backgroundColor: product.hex }}
              />
            ) : (
              <span className="glass-strong grid h-16 w-16 place-items-center rounded-full text-title font-semibold text-text">
                {monogram}
              </span>
            )}
            {product.brand && (
              <span className="clamp-2 text-small font-semibold text-text">{product.brand}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.brand && (
          <p className="clamp-1 text-label uppercase text-text-muted">
            {product.brand}
          </p>
        )}
        <p className="clamp-2 font-medium leading-snug text-text">
          {product.product}
        </p>

        {product.why && (
          <p className="clamp-2 mt-0.5 text-small leading-relaxed text-text-muted">
            {product.why}
          </p>
        )}

        {/* mt-auto pins this row to the bottom, so cards of differing blurb
            length still line up along their footer. */}
        <div className="mt-auto flex items-center gap-2 pt-3">
          {hasShade && (
            <>
              {product.hex && (
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
                  style={{ backgroundColor: product.hex }}
                  aria-hidden="true"
                />
              )}
              {/* Spelled out — colour alone can't carry meaning. */}
              <span className="clamp-1 text-small text-text-soft">
                {product.shade}
              </span>
            </>
          )}
          {product.price_range && (
            <span className="ml-auto shrink-0 font-medium text-small text-text-muted">
              {product.price_range}
            </span>
          )}
        </div>
      </div>

      {interactive && (
        <span className="sr-only">opens in a new tab</span>
      )}
    </Wrapper>
  );
}

/** Placeholder used while a whole category is still loading. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-tile border-4 border-white bg-swatch-ground shadow-card" aria-busy="true">
      <div className="relative aspect-4/5 overflow-hidden bg-mst-1/60" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="h-2.5 w-1/3 rounded-pill bg-raised" />
        <div className="h-3.5 w-3/4 rounded-pill bg-raised" />
        <div className="mt-auto h-2.5 w-1/2 rounded-pill bg-raised pt-3" />
      </div>
    </div>
  );
}
