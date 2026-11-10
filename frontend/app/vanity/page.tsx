"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Page } from "@/components/ui/Page";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import { pillClass } from "@/components/ui/PillGroup";
import { SignInGate } from "@/components/vanity/SignInGate";
import { InventoryGrid } from "@/components/vanity/InventoryGrid";
import { AddProduct } from "@/components/vanity/AddProduct";
import { ProductPanel } from "@/components/vanity/ProductPanel";
import { Aura } from "@/components/ui/Aura";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import {
  deleteInventoryItem,
  formatCents,
  listInventory,
  listRoutines,
  totalCents,
  listReplenishmentAlerts,
  cycleReplenishmentFlag,
  CATEGORY_LIFESPANS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  type InventoryItem,
  type Routine,
  type ProductStatus,
  type ReplenishmentAlert,
} from "@/lib/vanity";

export default function VanityPage() {
  return (
    <Page width="grid">
      <PageHeader
        label="Your vanity"
        title="Everything you own, in one place."
        description="Add what's on your shelf, then group products into looks you can repeat and share, with the cost worked out."
      >
        <Link href="/profile" className="inline-flex min-h-11 items-center text-small font-medium text-accent underline-offset-4 hover:underline">
          Public profile settings <span aria-hidden="true" className="ml-1">→</span>
        </Link>
      </PageHeader>

      <SignInGate
        title="Sign in to build your vanity"
        reason="Your shelf and your looks are saved to your account so they're there next time. Shade matching and the quiz stay free and account-free."
      >
        <VanityContent />
      </SignInGate>
    </Page>
  );
}

function VanityContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [alerts, setAlerts] = useState<ReplenishmentAlert[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reduced = useReducedMotion() ?? false;
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all" | "alerts">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [inventory, looks, replenishment] = await Promise.all([listInventory(), listRoutines(), listReplenishmentAlerts()]);
      setItems(inventory);
      setRoutines(looks);
      setAlerts(replenishment);
      setState("ready");
    } catch (caught) {
      // Almost always the migration not having been run yet, so say that
      // rather than surfacing a raw Postgres error.
      setError(
        caught instanceof Error && /(relation|column) .* does not exist|schema cache/i.test(caught.message)
          ? "The shelf schema is out of date. Apply the Supabase migrations in supabase/migrations/ before using the vanity."
          : "Couldn't load your vanity. Please try again.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shelf = items;
  const categories = useMemo(() => [...new Set(items.map((i) => i.category || "other"))].sort(), [items]);
  const flags = useMemo(() => Object.fromEntries(alerts.filter((alert) => alert.flagged_low || alert.flagged_empty).map((alert) => [alert.product_id, alert.flagged_empty ? "empty" : "low"])) as Record<string, "low" | "empty">, [alerts]);
  const filteredShelf = useMemo(() => shelf.filter((item) =>
    (statusFilter === "all" || (statusFilter === "alerts" ? Boolean(flags[item.id]) : item.status === statusFilter)) &&
    (categoryFilter === "all" || (item.category || "other") === categoryFilter)
  ), [shelf, statusFilter, categoryFilter, flags]);
  const { total, unpriced } = useMemo(() => totalCents(shelf), [shelf]);

  const byCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of shelf) {
      const key = item.category ?? "uncategorised";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [shelf]);

  if (state === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-card bg-raised" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/5 p-6" role="alert">
        <p className="font-medium text-text">Couldn&apos;t load your vanity</p>
        <p className="mt-2 text-small text-text-soft">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const openItem = items.find((item) => item.id === openId) ?? null;
  const lifespanFor = (item: InventoryItem) =>
    alerts.find((alert) => alert.product_id === item.id)?.estimated_lifespan_days ??
    CATEGORY_LIFESPANS[item.category?.toLowerCase() ?? ""] ??
    null;
  const flagged = items.filter((item) => flags[item.id]);

  const toggleFlag = async (item: InventoryItem) => {
    if (!user) return;
    const current = alerts.find((alert) => alert.product_id === item.id);
    try {
      const updated = await cycleReplenishmentFlag(item, current, user.id);
      setAlerts((prev) =>
        updated
          ? [...prev.filter((alert) => alert.product_id !== item.id), updated]
          : prev.filter((alert) => alert.product_id !== item.id),
      );
    } catch {
      setError("Couldn't update the replenishment flag.");
    }
  };

  const remove = async (item: InventoryItem) => {
    setOpenId(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try { await deleteInventoryItem(item.id); } catch { void load(); }
  };

  const panel = (headingId: string) =>
    openItem && user ? (
      <ProductPanel
        key={openItem.id}
        headingId={headingId}
        item={openItem}
        userId={user.id}
        lifespanDays={lifespanFor(openItem)}
        flag={flags[openItem.id]}
        onFlag={() => void toggleFlag(openItem)}
        onSaved={(updated) => {
          setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          void listReplenishmentAlerts().then(setAlerts).catch(() => undefined);
        }}
        onDelete={() => void remove(openItem)}
        onAdded={(added) => setItems((prev) => [added, ...prev])}
        onClose={() => setOpenId(null)}
      />
    ) : null;

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0">
      {/* At-a-glance numbers, so the page opens with something other than text. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Products", value: String(shelf.length) },
          { label: "Shelf value", value: formatCents(total) },
          { label: "Categories", value: String(byCategory.length) },
          { label: "Looks", value: String(routines.length) },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-card p-5">
            <p className="text-label uppercase text-text-muted">{stat.label}</p>
            <p className="mt-1 text-title font-semibold text-text tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      {unpriced > 0 && (
        <p className="mt-2 text-small text-text-muted">
          {unpriced} {unpriced === 1 ? "item has" : "items have"} no price, so
          the shelf value is a floor rather than a total.
        </p>
      )}

      <Section
        id="shelf"
        title="Your shelf"
        aside={
          <Button size="sm" onClick={() => setAdding((open) => !open)}>
            {adding ? "Close" : "Add a product"}
          </Button>
        }
      >
        {adding && user && (
          <AddProduct
            userId={user.id}
            onAdded={(item) => {
              setItems((prev) => [item, ...prev]);
              setAdding(false);
            }}
          />
        )}

        {shelf.length === 0 && !adding ? (
          <div className="rounded-card border border-dashed border-line-strong bg-white/40 p-10 text-center">
            <p className="font-medium text-text">Your shelf is empty</p>
            <p className="mx-auto mt-2 max-w-prose text-small text-text-soft">
              Add the products you already own. Once a few are in, you can group
              them into looks.
            </p>
            <Button className="mt-5" onClick={() => setAdding(true)}>
              Add your first product
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
              <button type="button" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")} className={pillClass(statusFilter === "all")}>
                Everything
              </button>
              <button
                type="button"
                aria-pressed={statusFilter === "alerts"}
                onClick={() => setStatusFilter(statusFilter === "alerts" ? "all" : "alerts")}
                className={pillClass(statusFilter === "alerts", "relative")}
              >
                Running low
                {Object.keys(flags).length > 0 && (
                  <>
                    <span className="tabular-nums text-text-muted">{Object.keys(flags).length}</span>
                    {/* Notification dot: something on the shelf is low or empty. */}
                    <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                      <span className="absolute inset-0 rounded-full bg-accent-vivid opacity-60 motion-safe:animate-ping [animation-iteration-count:3]" />
                      <span className="relative h-3 w-3 rounded-full border-2 border-bg bg-accent-vivid" />
                    </span>
                    <span className="sr-only">, needs attention</span>
                  </>
                )}
              </button>
            </div>
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <label className={FIELD_LABEL}>Status
                <select className={`mt-2 ${FIELD}`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProductStatus | "all" | "alerts")}>
                  <option value="all">All statuses</option>
                  <option value="alerts">Running low or empty</option>
                  {PRODUCT_STATUSES.map((status) => <option key={status} value={status}>{PRODUCT_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className={FIELD_LABEL}>Category
                <select className={`mt-2 ${FIELD}`} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>
            {filteredShelf.length === 0 ? <p className="py-8 text-center text-small text-text-muted">No products match these filters.</p> : (
              <div className="space-y-8">
                {(categoryFilter === "all" ? categories : [categoryFilter]).map((category) => {
                  const categoryItems = filteredShelf.filter((item) => (item.category || "other") === category);
                  if (!categoryItems.length) return null;
                  return <details key={category} open className="group">
                    <summary className="mb-3 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 border-b border-line-strong text-heading font-semibold capitalize text-text"><span>{category} <span className="ml-2 text-small font-normal text-text-muted">{categoryItems.length}</span></span><span aria-hidden="true" className="text-text-muted transition-transform duration-(--duration-fast) group-open:rotate-180">⌄</span></summary>
                    <div><InventoryGrid items={categoryItems} flags={flags} activeId={openId} onOpen={(item) => setOpenId(item.id)} /></div>
                  </details>;
                })}
              </div>
            )}
          </>
        )}
      </Section>


      <Section
        id="looks"
        title="Your looks"
        description="Group products from your shelf into a look, for going out or for every day, and share it with the cost worked out."
        aside={
          <Link
            href="/vanity/looks"
            className="inline-flex min-h-11 items-center text-small font-medium text-accent underline-offset-4 hover:underline"
          >
            Manage looks <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        }
      >
        {routines.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-white/40 p-8 text-center">
            <p className="text-small text-text-soft">
              {shelf.length === 0
                ? "Add a few products first, then build your first look."
                : "No looks yet."}
            </p>
            {shelf.length > 0 && (
              <Button size="sm" className="mt-4" onClick={() => router.push("/vanity/looks")}>
                Build a look
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routines.map((routine) => (
              <li key={routine.id}>
                <Link
                  href={`/vanity/looks?id=${routine.id}`}
                  className="flex h-full flex-col glass rounded-card p-5 transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-text">{routine.title}</p>
                    {routine.is_public && <Badge tone="success">Shared</Badge>}
                  </div>
                  {routine.occasion && (
                    <p className="mt-1 text-small text-text-muted">
                      {routine.occasion}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>

      <aside aria-label="Product details" className="hidden lg:block">
        <div className="tone-panel sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-card p-5">
          {isDesktop && openItem ? panel("product-panel-title") : (
            <ShelfSummary
              flagged={flagged}
              flags={flags}
              onOpen={(item) => setOpenId(item.id)}
              hasItems={items.length > 0}
            />
          )}
        </div>
      </aside>
    </div>

      <AnimatePresence>
        {!isDesktop && openItem && (
          <ProductSheet onClose={() => setOpenId(null)} reduced={reduced}>
            {panel("product-sheet-title")}
          </ProductSheet>
        )}
      </AnimatePresence>
    </>
  );
}

/** What the right column shows before a product is picked. */
function ShelfSummary({
  flagged,
  flags,
  onOpen,
  hasItems,
}: {
  flagged: InventoryItem[];
  flags: Record<string, "low" | "empty">;
  onOpen: (item: InventoryItem) => void;
  hasItems: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Aura variant="vanity" className="flex min-h-32 items-end p-5">
        <p className="text-heading font-semibold text-text">
          {hasItems ? "Tap a product" : "Your shelf starts here"}
        </p>
      </Aura>
      <p className="text-small text-text-soft">
        {hasItems
          ? "Details, status, replenishment and cheaper dupes open here, so you can move along the shelf without losing your place."
          : "Add what you own and each product's details, status and cheaper dupes will open here."}
      </p>
      {flagged.length > 0 && (
        <div>
          <p className="text-label uppercase text-text-muted">Running low</p>
          <ul className="mt-3 flex flex-col gap-2">
            {flagged.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-tile border border-white bg-white/70 px-3 py-2 text-left transition-[background-color,box-shadow] duration-(--duration-fast) hover:bg-white hover:shadow-card"
                >
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${flags[item.id] === "empty" ? "bg-danger" : "bg-warn"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block clamp-1 text-small font-medium text-text">{item.product}</span>
                    <span className="block text-small text-text-muted">{item.brand}</span>
                  </span>
                  <span className="shrink-0 text-small text-text-muted">{flags[item.id] === "empty" ? "Empty" : "Low"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Phones and tablets: the product panel as a bottom sheet. */
function ProductSheet({
  children,
  onClose,
  reduced,
}: {
  children: React.ReactNode;
  onClose: () => void;
  reduced: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    document.getElementById("product-sheet-title")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const transition = { duration: reduced ? 0.12 : 0.36, ease: EASE };
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-sheet-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-xl overflow-y-auto rounded-t-window border border-white bg-white/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-lift backdrop-blur-xl"
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        exit={reduced ? { opacity: 0 } : { y: "100%" }}
        transition={transition}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line-strong" />
        {children}
      </motion.section>
    </>
  );
}
