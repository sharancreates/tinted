"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Orb } from "@/components/ui/Orb";
import { Aura } from "@/components/ui/Aura";
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
 * needs: brand, product, shade, colour, price. The owner's wider shelf, their
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
        <div className="glass flex flex-col items-center gap-4 rounded-card p-8 text-center md:p-12">
          <Orb size="lg" />
          <h1 className="text-display font-semibold text-text">This look isn&apos;t available</h1>
          <p className="max-w-prose text-text-soft">
            It may have been unshared or deleted. Links only work while the owner
            keeps the look public.
          </p>
          <Link href="/" className="mt-2 inline-flex min-h-11 items-center text-small font-medium text-accent underline-offset-4 hover:underline">
            Go to Tinted <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </Page>
    );
  }

  const { routine, items } = data;
  const currency = items.find((i) => i.currency)?.currency ?? "USD";
  const hexes = items.map((i) => i.hex).filter(Boolean) as string[];
  // Paint the hero from the look's own colours when it has enough of them.
  const auraTones =
    hexes.length >= 2
      ? ([hexes[0], hexes[1 % hexes.length], hexes[2 % hexes.length], hexes[3 % hexes.length]] as [string, string, string, string])
      : undefined;

  return (
    <Page width="list">
      <Aura variant="looks" tones={auraTones} className="mb-8 flex min-h-56 flex-col justify-end p-6 md:p-8">
        <p className="text-label uppercase text-text-soft">A shared look</p>
        <h1 className="mt-1 text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
          {routine.title}
        </h1>
        {routine.description && <p className="mt-2 max-w-prose text-text-soft">{routine.description}</p>}
      </Aura>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="glass rounded-card p-5">
          <p className="text-label uppercase text-text-muted">Look total</p>
          <p className="mt-1 text-title font-semibold tabular-nums text-text">{formatCents(total, currency)}</p>
        </div>
        <div className="glass rounded-card p-5">
          <p className="text-label uppercase text-text-muted">Products</p>
          <p className="mt-1 text-title font-semibold tabular-nums text-text">{items.length}</p>
        </div>
        {routine.occasion && (
          <div className="glass col-span-2 rounded-card p-5 sm:col-span-1">
            <p className="text-label uppercase text-text-muted">Occasion</p>
            <p className="mt-1 text-title font-semibold capitalize text-text">{routine.occasion}</p>
          </div>
        )}
      </div>
      {unpriced > 0 && (
        <p className="-mt-5 mb-8 text-small text-text-muted">
          {unpriced} {unpriced === 1 ? "product has" : "products have"} no
          price recorded, so the total is a floor.
        </p>
      )}

      <ol className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.brand}-${item.product}-${index}`}
            className="glass flex items-center gap-4 rounded-tile p-4"
          >
            <span className="w-6 shrink-0 text-center text-small font-semibold tabular-nums text-text-muted">{index + 1}</span>
            <span
              className="h-12 w-12 shrink-0 rounded-full border-4 border-white shadow-card"
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

      <div className="glass mt-(--space-section) grid gap-6 rounded-card p-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-center md:p-5">
        <Aura variant="match" className="min-h-32 md:min-h-40" />
        <div className="p-2 md:p-0">
          <h2 className="text-title font-semibold text-text">Find your own shade</h2>
          <p className="mt-2 max-w-prose text-small text-text-soft">
            Tinted reads your depth and undertone from a photo, then matches you
            to products. No account needed.
          </p>
          <Link
            href="/match"
            className="mt-5 inline-flex min-h-12 items-center rounded-pill bg-text px-7 text-small font-semibold text-white transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
          >
            Find my shade
          </Link>
        </div>
      </div>
    </Page>
  );
}
