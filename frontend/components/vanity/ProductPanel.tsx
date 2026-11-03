"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { pillClass } from "@/components/ui/PillGroup";
import { FIELD, FIELD_LABEL, TEXTAREA, CHECKBOX } from "@/components/ui/field";
import { findDupes, type Dupe } from "@/lib/api";
import {
  addInventoryItem,
  formatCents,
  parsePriceToCents,
  updateInventoryItem,
  updateProductLifespanEstimate,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  type InventoryItem,
} from "@/lib/vanity";

type Flag = "low" | "empty" | undefined;

const FLAG_LABEL: Record<"none" | "low" | "empty", string> = {
  none: "Flag low",
  low: "Mark empty",
  empty: "Clear",
};

/**
 * Everything about one product on the shelf, beside the grid instead of in a
 * modal, so you can move from product to product without losing your place.
 * On phones the same content sits in a bottom sheet (see VanityPage).
 *
 * Mount it with `key={item.id}` so switching products resets the form.
 */
export function ProductPanel({
  item,
  userId,
  lifespanDays,
  flag,
  onFlag,
  onSaved,
  onDelete,
  onAdded,
  onClose,
  headingId = "product-panel-title",
}: {
  item: InventoryItem;
  userId: string;
  lifespanDays: number | null;
  flag: Flag;
  onFlag: () => void;
  onSaved: (item: InventoryItem) => void;
  onDelete: () => void;
  /** A dupe saved to the wishlist. */
  onAdded: (item: InventoryItem) => void;
  onClose: () => void;
  headingId?: string;
}) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [purchaseDate, setPurchaseDate] = useState(item.purchase_date ?? "");
  const [openedDate, setOpenedDate] = useState(item.opened_date ?? "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    item.purchase_price_cents === null ? "" : (item.purchase_price_cents / 100).toFixed(2),
  );
  const [repurchase, setRepurchase] = useState(item.is_repurchase);
  const [isPublic, setIsPublic] = useState(item.is_public);
  const [lifespanText, setLifespanText] = useState(lifespanDays?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [dupes, setDupes] = useState<Dupe[] | null>(null);
  const [dupesState, setDupesState] = useState<"idle" | "loading" | "error">("idle");
  const [wishlisted, setWishlisted] = useState<string[]>([]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const parsedLifespan = lifespanText.trim() ? Number(lifespanText) : null;
      if (parsedLifespan !== null && (!Number.isInteger(parsedLifespan) || parsedLifespan < 1)) {
        setError("Estimated use must be a whole number of days.");
        return;
      }
      const patch = {
        status,
        is_finished: status === "finished",
        notes: notes.trim() || null,
        purchase_date: purchaseDate || null,
        opened_date: openedDate || null,
        image_url: imageUrl.trim() || null,
        purchase_price_cents: parsePriceToCents(purchasePrice),
        is_repurchase: repurchase,
        is_public: isPublic,
      };
      await updateProductLifespanEstimate(item, userId, parsedLifespan);
      await updateInventoryItem(item.id, patch);
      onSaved({ ...item, ...patch });
      setSaved(true);
    } catch {
      setError("Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const loadDupes = async () => {
    setDupesState("loading");
    try {
      const { results } = await findDupes(item);
      setDupes(results);
      setDupesState("idle");
    } catch {
      setDupesState("error");
    }
  };

  const wishlist = async (dupe: Dupe) => {
    const key = `${dupe.brand}|${dupe.product}`;
    try {
      const added = await addInventoryItem(
        {
          brand: dupe.brand,
          product: dupe.product,
          shade: dupe.shade,
          category: item.category,
          hex: null,
          image_url: null,
          url: null,
          price_cents: dupe.price_cents,
          notes: `Dupe for ${item.brand} ${item.product}`,
          status: "wishlist",
          is_public: false,
        },
        userId,
      );
      setWishlisted((prev) => [...prev, key]);
      onAdded(added);
    } catch {
      setError("Couldn't add that to your wishlist.");
    }
  };

  const flagKey = flag ?? "none";

  return (
    <div className="flex flex-col gap-6">
      {/* Product */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-label uppercase text-text-muted">Product</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg text-text-soft transition-colors duration-(--duration-fast) hover:bg-white/60 hover:text-text"
          >
            ×
          </button>
        </div>
        <div
          className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-tile border-4 border-white bg-swatch-ground shadow-card"
          style={item.hex && !item.image_url ? { backgroundColor: item.hex } : undefined}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="h-full w-full object-contain p-4" />
          ) : !item.hex ? (
            <span className="text-display font-semibold text-text-muted/40" aria-hidden="true">
              {item.brand.charAt(0).toUpperCase()}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-label uppercase text-text-muted">{item.brand}</p>
          <h2 id={headingId} tabIndex={-1} className="mt-1 text-title font-semibold text-text outline-none">
            {item.product}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-text-soft">
            {item.shade && (
              <span className="flex items-center gap-1.5">
                {item.hex && (
                  <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-line-strong" style={{ backgroundColor: item.hex }} />
                )}
                {item.shade}
              </span>
            )}
            {item.category && <span className="capitalize">{item.category}</span>}
            {item.price_cents !== null && <span className="tabular-nums">{formatCents(item.price_cents, item.currency)}</span>}
          </div>
        </div>
      </div>

      {/* Status */}
      <fieldset className="min-w-0">
        <legend className={FIELD_LABEL}>Status</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRODUCT_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={pillClass(status === value, "min-h-10 px-3.5")}
            >
              {PRODUCT_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Replenishment */}
      <div className="flex items-center justify-between gap-3 rounded-tile border border-white bg-white/60 p-4">
        <div className="min-w-0">
          <p className="text-small font-medium text-text">
            {flag === "empty" ? "Empty" : flag === "low" ? "Running low" : "Stocked"}
          </p>
          <p className="text-small text-text-muted">
            {flag ? "Shows on your shelf until you clear it." : "Flag it when it's nearly gone."}
          </p>
        </div>
        <Button size="sm" className="shrink-0 whitespace-nowrap" variant={flag ? "secondary" : "ghost"} onClick={onFlag}>
          {FLAG_LABEL[flagKey]}
        </Button>
      </div>

      {/* Dupes */}
      <section aria-labelledby="dupes-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="dupes-heading" className={FIELD_LABEL}>Cheaper dupes</h3>
          {dupes === null && (
            <Button size="sm" variant="secondary" onClick={() => void loadDupes()} disabled={dupesState === "loading"}>
              {dupesState === "loading" ? "Finding…" : "Find dupes"}
            </Button>
          )}
        </div>
        {dupesState === "loading" && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-tile bg-raised" />)}
          </div>
        )}
        {dupesState === "error" && (
          <p className="text-small text-danger" role="alert">
            Couldn&apos;t find dupes right now.{" "}
            <button type="button" className="cursor-pointer font-medium underline" onClick={() => void loadDupes()}>Try again</button>
          </p>
        )}
        {dupes !== null && dupes.length === 0 && (
          <p className="text-small text-text-muted">No close, cheaper match we&apos;re confident about.</p>
        )}
        {dupes !== null && dupes.length > 0 && (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {dupes.map((dupe) => {
              const key = `${dupe.brand}|${dupe.product}`;
              const added = wishlisted.includes(key);
              return (
                <li key={key} className="rounded-tile border border-white bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label uppercase text-text-muted">{dupe.brand}</p>
                      <p className="text-small font-medium text-text">{dupe.product}</p>
                      {dupe.shade && <p className="text-small text-text-soft">{dupe.shade}</p>}
                    </div>
                    {dupe.price_cents !== null && (
                      <span className="shrink-0 text-small tabular-nums text-text-muted">~{formatCents(dupe.price_cents)}</span>
                    )}
                  </div>
                  {dupe.why && <p className="mt-2 text-small text-text-soft">{dupe.why}</p>}
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => void wishlist(dupe)}
                    className="mt-2 min-h-10 cursor-pointer text-small font-medium text-accent underline-offset-4 hover:underline disabled:cursor-default disabled:text-success disabled:no-underline"
                  >
                    {added ? "Added to wishlist" : "Add to wishlist"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {dupes !== null && dupes.length > 0 && (
          <p className="text-small text-text-muted">Suggestions and prices are estimates. Check the shade before buying.</p>
        )}
      </section>

      {/* Details */}
      <section aria-labelledby="details-heading" className="flex flex-col gap-4 border-t border-line-strong pt-6">
        <h3 id="details-heading" className={FIELD_LABEL}>Details</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="block">
            <span className={FIELD_LABEL}>Purchased</span>
            <input className={`mt-2 ${FIELD}`} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Opened</span>
            <input className={`mt-2 ${FIELD}`} type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>What you paid</span>
            <input className={`mt-2 ${FIELD}`} type="text" inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="24.00" />
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Lasts about (days)</span>
            <input className={`mt-2 ${FIELD}`} type="number" min="1" step="1" value={lifespanText} onChange={(e) => setLifespanText(e.target.value)} placeholder="Category estimate" />
          </label>
        </div>
        <label className="block">
          <span className={FIELD_LABEL}>Photo URL</span>
          <input className={`mt-2 ${FIELD}`} type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="block">
          <span className={FIELD_LABEL}>Notes</span>
          <textarea className={`mt-2 ${TEXTAREA}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </label>
        <div className="flex flex-col">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-text-soft">
            <input type="checkbox" className={CHECKBOX} checked={repurchase} onChange={(e) => setRepurchase(e.target.checked)} />
            I would buy this again
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small text-text-soft">
            <input type="checkbox" className={CHECKBOX} checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Show on my public profile
          </label>
        </div>
      </section>

      {error && <p className="text-small text-danger" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        {saved && !saving && <span className="text-small text-success" role="status">Saved</span>}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto min-h-11 cursor-pointer text-small text-text-muted transition-colors duration-(--duration-fast) hover:text-danger"
        >
          Remove from shelf
        </button>
      </div>
    </div>
  );
}
