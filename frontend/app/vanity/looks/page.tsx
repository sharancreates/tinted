"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Page } from "@/components/ui/Page";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { FIELD, FIELD_LABEL, CHECKBOX } from "@/components/ui/field";
import { SignInGate } from "@/components/vanity/SignInGate";
import { InventoryGrid } from "@/components/vanity/InventoryGrid";
import {
  addItemToRoutine,
  createRoutine,
  deleteRoutine,
  formatCents,
  getRoutineWithItems,
  listInventory,
  listRoutines,
  removeRoutineItem,
  reorderRoutineItems,
  setRoutineVisibility,
  totalCents,
  type InventoryItem,
  type Routine,
  type RoutineItem,
} from "@/lib/vanity";

export default function LooksPage() {
  return (
    <Page width="grid">
      <PageHeader
        label="Looks"
        title="Build a look you can repeat."
        description="Pick products off your shelf, put them in the order you apply them, and share the result with the cost included."
      />

      <SignInGate
        title="Sign in to build looks"
        reason="Looks are built from your saved shelf, so they live with your account."
        cta="Sign in to build a look"
        aura="looks"
      >
        <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-raised" />}>
          <LooksContent />
        </Suspense>
      </SignInGate>
    </Page>
  );
}

function LooksContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("id");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [shelf, looks] = await Promise.all([listInventory(), listRoutines()]);
      setInventory(shelf.filter((i) => !i.is_finished));
      setRoutines(looks);
      setState("ready");
    } catch (caught) {
      setError(
        caught instanceof Error && /relation .* does not exist/i.test(caught.message)
          ? "The shelf schema is out of date. Apply the Supabase migrations in supabase/migrations/ before building looks."
          : "Couldn't load your looks.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return <div className="h-64 animate-pulse rounded-card bg-raised" aria-busy="true" />;
  }
  if (state === "error") {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-6" role="alert">
        <p className="font-medium text-text">Couldn&apos;t load your looks</p>
        <p className="mt-2 text-small text-text-soft">{error}</p>
      </div>
    );
  }

  if (activeId) {
    return (
      <LookEditor
        routineId={activeId}
        inventory={inventory}
        onClose={() => router.push("/vanity/looks")}
        onChanged={load}
      />
    );
  }

  return (
    <>
      {inventory.length === 0 && (
        <div className="mb-(--space-block) rounded-card border border-dashed border-line-strong bg-raised/40 p-8 text-center">
          <p className="font-medium text-text">Your shelf is empty</p>
          <p className="mx-auto mt-2 max-w-prose text-small text-text-soft">
            A look is built from products you own, so start there.
          </p>
          <Button size="sm" className="mt-4" onClick={() => router.push("/vanity")}>
            Add products
          </Button>
        </div>
      )}

      {user && inventory.length > 0 && (
        <NewLookForm
          userId={user.id}
          onCreated={(routine) => router.push(`/vanity/looks?id=${routine.id}`)}
        />
      )}

      <Section id="all-looks" title="Your looks" aside={`${routines.length}`}>
        {routines.length === 0 ? (
          <p className="text-small text-text-muted">Nothing yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routines.map((routine) => (
              <li key={routine.id} className="flex flex-col gap-2">
                <Link
                  href={`/vanity/looks?id=${routine.id}`}
                  className="flex flex-1 flex-col glass rounded-card p-5 transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-text">{routine.title}</p>
                    {routine.is_public && <Badge tone="success">Shared</Badge>}
                  </div>
                  {routine.occasion && (
                    <p className="mt-1 text-small text-text-muted">{routine.occasion}</p>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
                    try {
                      await deleteRoutine(routine.id);
                    } catch {
                      void load();
                    }
                  }}
                  className="min-h-11 self-start px-1 text-small text-text-muted transition-colors duration-(--duration-fast) hover:text-danger"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

// ── New look ──────────────────────────────────────────────────────────────────

function NewLookForm({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (routine: Routine) => void;
}) {
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="glass rounded-card p-5 md:p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
          onCreated(
            await createRoutine(
              { title: title.trim(), occasion: occasion.trim() || undefined },
              userId,
            ),
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className={FIELD_LABEL}>New look</span>
          <input
            className={`mt-2 ${FIELD}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Going out"
          />
        </label>
        <label className="block">
          <span className={FIELD_LABEL}>Occasion</span>
          <input
            className={`mt-2 ${FIELD}`}
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="evening"
          />
        </label>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

function LookEditor({
  routineId,
  inventory,
  onClose,
  onChanged,
}: {
  routineId: string;
  inventory: InventoryItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [steps, setSteps] = useState<RoutineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const { routine, items } = await getRoutineWithItems(routineId);
    setRoutine(routine);
    setSteps(items);
  }, [routineId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chosenIds = useMemo(
    () => steps.map((s) => s.inventory_item_id).filter(Boolean) as string[],
    [steps],
  );

  const stepProducts = useMemo(
    () => steps.map((s) => s.inventory_items ?? null),
    [steps],
  );

  const { total, unpriced } = useMemo(
    () =>
      totalCents(
        stepProducts.map((p) => ({ price_cents: p?.price_cents ?? null })),
      ),
    [stepProducts],
  );

  const toggle = async (item: InventoryItem) => {
    setBusy(true);
    try {
      const existing = steps.find((s) => s.inventory_item_id === item.id);
      if (existing) await removeRoutineItem(existing.id);
      else await addItemToRoutine(routineId, item.id, steps.length);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...steps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next); // optimistic — reordering should feel instant
    try {
      await reorderRoutineItems(next);
    } catch {
      void refresh();
    }
  };

  if (!routine) {
    return <div className="h-64 animate-pulse rounded-card bg-raised" aria-busy="true" />;
  }

  const shareUrl =
    routine.is_public && routine.share_slug && typeof window !== "undefined"
      ? `${window.location.origin}/r/${encodeURIComponent(routine.share_slug)}`
      : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            <span aria-hidden="true">←</span> All looks
          </button>
          <h2 className="mt-1 text-display font-semibold text-text">{routine.title}</h2>
          {routine.occasion && (
            <p className="text-small text-text-muted">{routine.occasion}</p>
          )}
        </div>

        <div className="glass rounded-card px-5 py-3 text-right">
          <p className="text-label uppercase text-text-muted">Look total</p>
          <p className="text-title font-semibold text-text tabular-nums">
            {formatCents(total)}
          </p>
          {unpriced > 0 && (
            <p className="text-label text-text-muted">
              {unpriced} without a price
            </p>
          )}
        </div>
      </div>

      {/* Colour strip of the look so far — reads before any product name. */}
      {stepProducts.some((p) => p?.hex) && (
        <div className="mt-6 flex h-10 overflow-hidden rounded-pill border-4 border-white shadow-card">
          {stepProducts.map((p, i) =>
            p?.hex ? (
              <div key={i} className="flex-1" style={{ backgroundColor: p.hex }} />
            ) : null,
          )}
        </div>
      )}

      <Section id="steps" title="Steps" aside={`${steps.length}`}>
        {steps.length === 0 ? (
          <p className="text-small text-text-muted">
            Nothing added yet. Pick from your shelf below.
          </p>
        ) : (
          <ol className="space-y-2">
            {steps.map((step, index) => {
              const product = step.inventory_items;
              return (
                <li
                  key={step.id}
                  className="glass flex items-center gap-3 rounded-tile p-3"
                >
                  <span
                    className="h-10 w-10 shrink-0 rounded-full border border-line-strong"
                    style={{ backgroundColor: product?.hex ?? "var(--color-raised)" }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-label uppercase text-text-muted">
                      Step {index + 1}
                    </p>
                    <p className="clamp-1 font-medium text-text">
                      {product ? `${product.brand} ${product.product}` : "Product removed from shelf"}
                    </p>
                  </div>
                  <span className="shrink-0 text-small tabular-nums text-text-muted">
                    {formatCents(product?.price_cents ?? null, product?.currency)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move step ${index + 1} earlier`}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-line bg-raised text-text-soft transition-colors duration-(--duration-fast) hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(index, 1)}
                      disabled={index === steps.length - 1}
                      aria-label={`Move step ${index + 1} later`}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-line bg-raised text-text-soft transition-colors duration-(--duration-fast) hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section
        id="pick"
        title="Add from your shelf"
        description="Tap a product to add or remove it."
      >
        <div aria-busy={busy}>
          <InventoryGrid
            items={inventory}
            selectable
            selectedIds={chosenIds}
            onToggle={(item) => void toggle(item)}
          />
        </div>
      </Section>

      <Section id="share" title="Sharing">
        <div className="glass rounded-card p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={routine.is_public}
              onChange={async (event) => {
                const next = event.target.checked;
                setRoutine({ ...routine, is_public: next });
                try {
                  await setRoutineVisibility(routine.id, next);
                  onChanged();
                } catch {
                  setRoutine({ ...routine, is_public: !next });
                }
              }}
              className={`mt-0.5 ${CHECKBOX}`}
            />
            <span>
              <span className="font-medium text-text">
                Anyone with the link can see this look
              </span>
              <span className="mt-1 block text-small text-text-soft">
                Shares the products in this look and their prices. The rest of
                your shelf stays private.
              </span>
            </span>
          </label>

          {shareUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-pill border border-line bg-raised px-5 py-3 font-mono text-small text-text-soft">
                {shareUrl}
              </code>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center px-2 text-small font-medium text-accent hover:underline"
              >
                Preview
              </a>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
