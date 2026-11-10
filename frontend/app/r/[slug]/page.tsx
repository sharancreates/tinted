"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Badge } from "@/components/ui/Badge";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import {
  formatCents,
  getSharedRoutine,
  totalCents,
  type Routine,
  type SharedItem,
} from "@/lib/vanity";

/**
 * A shared look, readable without an account.
 *
 * Reads through the shared_routine_items view, which exposes only what a look
 * needs — brand, product, shade, colour, price. The owner's wider shelf, their
 * notes and their purchase history are never reachable from this page.
 */
export default function SharedLookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [data, setData] = useState<{ routine: Routine; items: SharedItem[] } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    getSharedRoutine(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState("missing");
          return;
        }
        setData(result);
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { total, unpriced } = useMemo(
    () => totalCents(data?.items ?? []),
    [data],
  );

  if (state === "loading") {
    return (
      <Page width="list">
        <div className="h-10 w-64 animate-pulse rounded-pill bg-raised" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      </Page>
    );
  }

  if (state === "missing" || !data) {
    return (
      <Page width="prose">
        <h1 className="font-display text-display text-text">
          This look isn&apos;t available
        </h1>
        <p className="mt-3 text-text-soft">
          It may have been unshared or deleted. Links only work while the owner
          keeps the look public.
        </p>
        <Link href="/" className="mt-6 inline-block font-medium text-accent hover:underline">
          Go to Tinted →
        </Link>
      </Page>
    );
  }

  const { routine, items } = data;
  const currency = items.find((i) => i.currency)?.currency ?? "USD";

  return (
    <Page width="list">
      <header className="mb-(--space-section)">
        <p className="text-label uppercase text-accent">A shared look</p>
        <h1 className="mt-2 font-display text-display text-text">
          {routine.title}
        </h1>
        {routine.description && (
          <p className="mt-3 max-w-prose text-text-soft">{routine.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {routine.occasion && <Badge tone="neutral">{routine.occasion}</Badge>}
          <Badge tone="accent">
            {items.length} {items.length === 1 ? "product" : "products"}
          </Badge>
          <Badge tone="success">{formatCents(total, currency)} total</Badge>
        </div>
        {unpriced > 0 && (
          <p className="mt-2 text-small text-text-muted">
            {unpriced} {unpriced === 1 ? "product has" : "products have"} no
            price recorded, so the total is a floor.
          </p>
        )}
      </header>

      {/* Colour strip of the whole look — recognisable before any text is read. */}
      {items.some((i) => i.hex) && (
        <div className="mb-(--space-block) flex h-10 overflow-hidden rounded-pill ring-1 ring-line">
          {items.filter((i) => i.hex).map((item, index) => (
            <div
              key={`${item.brand}-${index}`}
              className="flex-1"
              style={{ backgroundColor: item.hex ?? undefined }}
            />
          ))}
        </div>
      )}

      <ol className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.brand}-${item.product}-${index}`}
            className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <span
              className="h-12 w-12 shrink-0 rounded-full border border-line-strong"
              style={{ backgroundColor: item.hex ?? "var(--color-raised)" }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-label uppercase text-text-muted">
                {item.category ?? `Step ${index + 1}`}
              </p>
              <p className="font-medium text-text">
                {item.brand} {item.product}
              </p>
              {item.shade && (
                <p className="text-small text-text-soft">{item.shade}</p>
              )}
            </div>
            <span className="shrink-0 text-small tabular-nums text-text-muted">
              {formatCents(item.price_cents, item.currency ?? currency)}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-(--space-section) overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <ToneRibbon size="sm" className="rounded-none ring-0" />
        <div className="p-8 text-center">
          <h2 className="font-display text-title text-text">
            Find your own shade
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-small text-text-soft">
            Tinted reads your depth and undertone from a photo, then matches you
            to products. No account needed.
          </p>
          <Link
            href="/match"
            className="mt-5 inline-flex min-h-12 items-center rounded-pill bg-accent px-8 font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Find my shade
          </Link>
        </div>
      </div>
    </Page>
  );
}
