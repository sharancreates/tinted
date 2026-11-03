"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parsePriceToCents, updateInventoryItem, updateProductLifespanEstimate } from "@/lib/vanity";
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, type InventoryItem } from "@/lib/vanity";

const FIELD = "min-h-11 w-full rounded-card border border-line bg-surface px-3 text-small text-text focus:border-accent focus:outline-none";

export function EditProduct({
  item,
  onClose,
  onSaved,
  userId,
  lifespanDays,
}: {
  item: InventoryItem;
  userId: string;
  lifespanDays: number | null;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [purchaseDate, setPurchaseDate] = useState(item.purchase_date ?? "");
  const [openedDate, setOpenedDate] = useState(item.opened_date ?? "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [purchasePrice, setPurchasePrice] = useState(item.purchase_price_cents === null ? "" : (item.purchase_price_cents / 100).toFixed(2));
  const [repurchase, setRepurchase] = useState(item.is_repurchase);
  const [isPublic, setIsPublic] = useState(item.is_public);
  const [lifespanText, setLifespanText] = useState(lifespanDays?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
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
      const parsedLifespan = lifespanText.trim() ? Number(lifespanText) : null;
      if (parsedLifespan !== null && (!Number.isInteger(parsedLifespan) || parsedLifespan < 1)) {
        throw new Error("Lifespan must be a positive number of days.");
      }
      await updateProductLifespanEstimate(item, userId, parsedLifespan);
      await updateInventoryItem(item.id, patch);
      onSaved({ ...item, ...patch });
    } catch {
      setError("Couldn't save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-product-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-card border border-line bg-surface p-5 shadow-lift sm:rounded-card sm:p-7">
        <p className="text-label uppercase text-accent">Update your shelf</p>
        <h2 id="edit-product-title" className="mt-1 font-display text-heading text-text">{item.brand} {item.product}</h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-label uppercase text-text-muted">Status
            <select className={`mt-1 ${FIELD}`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {PRODUCT_STATUSES.map((value) => <option key={value} value={value}>{PRODUCT_STATUS_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="text-label uppercase text-text-muted">Purchase date
            <input className={`mt-1 ${FIELD}`} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </label>
          <label className="text-label uppercase text-text-muted">Opened date
            <input className={`mt-1 ${FIELD}`} type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
          </label>
          <label className="text-label uppercase text-text-muted">What you paid
            <input className={`mt-1 ${FIELD}`} type="text" inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="24.00" />
          </label>
          <label className="text-label uppercase text-text-muted">Product photo URL
            <input className={`mt-1 ${FIELD}`} type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="text-label uppercase text-text-muted">Estimated use, in days
            <input className={`mt-1 ${FIELD}`} type="number" min="1" step="1" value={lifespanText} onChange={(e) => setLifespanText(e.target.value)} placeholder="Category estimate" />
          </label>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-small text-text-soft">
          <input type="checkbox" checked={repurchase} onChange={(e) => setRepurchase(e.target.checked)} />
          I would buy this again
        </label>
        <label className="flex min-h-11 items-center gap-2 text-small text-text-soft">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Show this product on my public profile
        </label>
        <label className="mt-3 block text-label uppercase text-text-muted">Notes
          <textarea className={`mt-1 min-h-24 ${FIELD} py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </label>
        {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </section>
    </div>
  );
}
