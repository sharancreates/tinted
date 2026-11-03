"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { listInventory, getOrCreateSkincareRoutine, listRoutineSteps, addRoutineStep, addLinkedRoutineSteps, moveRoutineStep, removeRoutineStep, setRoutineVisibility, type InventoryItem, type Routine, type RoutineItem, type SkincareRoutineType } from "@/lib/vanity";
import { suggestShelfRoutine } from "@/lib/api";

const TYPES: { id: SkincareRoutineType; label: string }[] = [
  { id: "morning", label: "AM" }, { id: "evening", label: "PM" }, { id: "weekly", label: "Weekly" },
];

export default function RoutinePage() {
  const { user, loading: authLoading } = useAuth();
  const [active, setActive] = useState<SkincareRoutineType>("morning");
  const [routines, setRoutines] = useState<Record<string, Routine>>({});
  const [steps, setSteps] = useState<Record<string, RoutineItem[]>>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customStep, setCustomStep] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionReason, setSuggestionReason] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const shelf = await listInventory();
      const routineRows = await Promise.all(TYPES.map(({ id }) => getOrCreateSkincareRoutine(id, user.id)));
      const stepRows = await Promise.all(routineRows.map((routine) => listRoutineSteps(routine.id)));
      setInventory(shelf.filter((item) => item.status !== "finished"));
      setRoutines(Object.fromEntries(routineRows.map((routine) => [routine.routine_type, routine])));
      setSteps(Object.fromEntries(routineRows.map((routine, index) => [routine.routine_type, stepRows[index]])));
    } catch {
      setError("Couldn't load routines. Apply the Supabase migrations and try again.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const activeRoutine = routines[active];
  const activeSteps = steps[active] ?? [];
  const options = useMemo(() => inventory.map((item) => ({
    id: item.id, label: `${item.brand} ${item.product}${item.shade ? ` · ${item.shade}` : ""}`,
  })), [inventory]);
  const hasSkincareSteps = Boolean((steps.morning?.length ?? 0) + (steps.evening?.length ?? 0));

  const suggestFromShelf = async () => {
    if (!inventory.length) return;
    setSuggesting(true);
    setError("");
    try {
      const suggestion = await suggestShelfRoutine(inventory.map(({ id, brand, product, category }) => ({ id, brand, product, category })));
      for (const type of ["morning", "evening"] as const) {
        const target = await getOrCreateSkincareRoutine(type, user!.id);
        const existing = await listRoutineSteps(target.id);
        const rows = suggestion[type].filter((step) => inventory.some((item) => item.id === step.product_id));
        if (!existing.length) await addLinkedRoutineSteps(target.id, rows);
      }
      setSuggestionReason(suggestion.reasoning);
      await load();
    } catch { setError("Couldn't create routine suggestions right now."); }
    finally { setSuggesting(false); }
  };

  const insertStep = async (product: InventoryItem | null) => {
    if (!activeRoutine || (!product && !customStep.trim())) return;
    try {
      const created = await addRoutineStep(activeRoutine.id, product?.category || customStep.trim(), product?.id ?? null, activeSteps.length);
      setSteps((prev) => ({ ...prev, [active]: [...(prev[active] ?? []), created] }));
      setCustomStep("");
      setSelectedProduct("");
    } catch { setError("Couldn't add that step."); }
  };

  const reorder = async (from: number, to: number) => {
    try {
      const reordered = await moveRoutineStep(activeSteps, from, to);
      setSteps((prev) => ({ ...prev, [active]: reordered }));
    }
    catch { setError("Couldn't reorder the steps. Please try again."); }
  };

  if (authLoading || (user && busy)) return <Page width="list"><p className="text-text-muted">Loading your routines…</p></Page>;

  if (!user) return <Page width="prose"><h1 className="font-display text-display text-text">Your skincare routine</h1><p className="mt-3 text-text-soft">Sign in to build and save AM and PM routines from products on your shelf.</p><Link href="/vanity" className="mt-5 inline-block text-accent underline">Open your shelf to sign in</Link></Page>;

  return <Page width="grid">
    <header className="mb-8">
      <p className="text-label uppercase text-accent">Routine builder</p>
      <h1 className="mt-2 font-display text-display text-text">A routine that fits your shelf.</h1>
      <p className="mt-3 max-w-prose text-text-soft">Arrange your products in application order, or add a step before you have a product for it.</p>
    </header>
    {!hasSkincareSteps && inventory.length > 0 && <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-accent/30 bg-accent-dim p-5"><div><h2 className="font-display text-heading text-text">Start with what you own</h2><p className="mt-1 text-small text-text-soft">Get a suggested AM and PM order for products on your shelf.</p></div><Button onClick={() => void suggestFromShelf()} disabled={suggesting}>{suggesting ? "Building suggestions…" : "Suggest my routines"}</Button></section>}
    {suggestionReason && <p className="mb-5 text-small text-text-muted">{suggestionReason}</p>}
    <div className="mb-5 grid grid-cols-3 rounded-pill border border-line bg-surface p-1 sm:hidden">
      {TYPES.map(({ id, label }) => <button key={id} type="button" onClick={() => setActive(id)} aria-pressed={active === id} className={`min-h-11 rounded-pill text-small ${active === id ? "bg-accent-dim font-semibold text-accent" : "text-text-muted"}`}>{label}</button>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      {TYPES.map(({ id, label }) => {
        const routine = routines[id];
        const routineSteps = steps[id] ?? [];
        return <section key={id} className={`rounded-card border border-line bg-surface p-5 sm:p-6 ${active !== id ? "hidden sm:block" : ""}`}>
          <div className="flex items-baseline justify-between"><h2 className="font-display text-title text-text">{label === "AM" ? "Morning" : label === "PM" ? "Evening" : "Weekly care"}</h2><span className="text-small text-text-muted">{routineSteps.length} steps</span></div>
          {routine && <label className="mt-2 flex min-h-10 items-center gap-2 text-small text-text-muted"><input type="checkbox" checked={routine.is_public} onChange={async (event) => {
            const isPublic = event.target.checked;
            setRoutines((prev) => ({ ...prev, [id]: { ...prev[id], is_public: isPublic } }));
            try { await setRoutineVisibility(routine.id, isPublic); }
            catch { setError("Couldn't update routine visibility."); void load(); }
          }} />Show this routine on my public profile</label>}
          <ol className="mt-4 space-y-2" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            const from = Number(event.dataTransfer.getData("text/plain"));
            const to = Number((event.target as HTMLElement).closest("li")?.dataset.index);
            if (Number.isInteger(from) && Number.isInteger(to)) void reorder(from, to);
          }}>
            {routineSteps.map((step, index) => <li key={step.id} data-index={index} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} className="flex items-center gap-3 rounded-card border border-line bg-raised p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-dim font-display text-small text-accent">{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="text-label uppercase text-text-muted">{step.step_name || "Step"}</p><p className="clamp-1 text-small font-medium text-text">{step.inventory_items ? `${step.inventory_items.brand} ${step.inventory_items.product}` : "Add a product from your shelf"}</p></div>
              <div className="flex gap-1"><button type="button" className="min-h-10 min-w-10 text-text-muted" aria-label={`Move step ${index + 1} up`} onClick={() => void reorder(index, index - 1)}>↑</button><button type="button" className="min-h-10 min-w-10 text-text-muted" aria-label={`Move step ${index + 1} down`} onClick={() => void reorder(index, index + 1)}>↓</button><button type="button" className="min-h-10 min-w-10 text-danger" aria-label={`Remove step ${index + 1}`} onClick={async () => { try { await removeRoutineStep(step.id); setSteps((prev) => ({ ...prev, [id]: routineSteps.filter((item) => item.id !== step.id) })); } catch { setError("Couldn't remove that step."); } }}>×</button></div>
            </li>)}
          </ol>
          {routineSteps.length === 0 && <p className="mt-4 rounded-card border border-dashed border-line p-5 text-center text-small text-text-muted">Add products in the order you use them.</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select aria-label={`Choose a shelf product for ${label}`} className="min-h-11 rounded-card border border-line bg-white px-3 text-small" value={id === active ? selectedProduct : ""} onChange={(event) => { setActive(id); setSelectedProduct(event.target.value); }}>
              <option value="">Add from your shelf…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={id !== active || !selectedProduct} onClick={() => void insertStep(inventory.find((item) => item.id === selectedProduct) ?? null)}>Add product</Button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input className="min-h-11 rounded-card border border-line bg-white px-3 text-small" placeholder="Or type a step, such as Cleanser" value={id === active ? customStep : ""} onChange={(event) => { setActive(id); setCustomStep(event.target.value); }} />
            <Button size="sm" variant="ghost" disabled={id !== active || !customStep.trim()} onClick={() => void insertStep(null)}>Add step</Button>
          </div>
        </section>;
      })}
    </div>
    {error && <p className="mt-4 text-small text-danger" role="alert">{error}</p>}
  </Page>;
}
