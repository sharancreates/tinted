"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Aura } from "@/components/ui/Aura";
import { pillClass } from "@/components/ui/PillGroup";
import { FIELD, CHECKBOX } from "@/components/ui/field";
import { SignInGate } from "@/components/vanity/SignInGate";
import { useAuth } from "@/hooks/useAuth";
import { listInventory, getOrCreateSkincareRoutine, listRoutineSteps, addRoutineStep, addLinkedRoutineSteps, moveRoutineStep, removeRoutineStep, setRoutineVisibility, type InventoryItem, type Routine, type RoutineItem, type SkincareRoutineType } from "@/lib/vanity";
import { suggestShelfRoutine } from "@/lib/api";

const TYPES: { id: SkincareRoutineType; label: string }[] = [
  { id: "morning", label: "AM" }, { id: "evening", label: "PM" }, { id: "weekly", label: "Weekly" },
];

const TITLES: Record<SkincareRoutineType, string> = { morning: "Morning", evening: "Evening", weekly: "Weekly care" };

const ICON_BUTTON =
  "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-raised text-text-soft " +
  "transition-colors duration-(--duration-fast) hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30";

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

  if (authLoading || (user && busy)) {
    return (
      <Page width="grid">
        <div className="h-10 w-72 animate-pulse rounded-pill bg-raised" aria-busy="true" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-72 animate-pulse rounded-card bg-raised" />)}
        </div>
      </Page>
    );
  }

  if (!user) {
    return (
      <Page width="grid">
        <PageHeader
          label="Routine builder"
          title="A routine that fits your shelf."
          description="Arrange your products in the order you apply them, morning, evening and weekly."
        />
        <SignInGate
          title="Sign in to build your routine"
          reason="Routines are built from the products on your shelf, so they're saved to your account."
          cta="Sign in to build a routine"
          aura="quiz"
          perks={[
            ["AM, PM and weekly", "Three routines, each in application order."],
            ["Built from your shelf", "Or add a step before you own the product."],
            ["Suggested for you", "Get a starting order from what you already have."],
          ]}
        >
          {null}
        </SignInGate>
      </Page>
    );
  }

  return (
    <Page width="grid">
      <PageHeader
        label="Routine builder"
        title="A routine that fits your shelf."
        description="Arrange your products in application order, or add a step before you have a product for it."
      />

      {!hasSkincareSteps && inventory.length > 0 && (
        <section className="mb-6 grid gap-4 overflow-hidden rounded-card md:grid-cols-[minmax(0,1fr)_auto] md:items-center glass p-4 md:p-5">
          <div className="flex items-center gap-4">
            <Aura variant="quiz" className="aura-thumb h-16 w-16 shrink-0 rounded-sm border-2" />
            <div>
              <h2 className="text-heading font-semibold text-text">Start with what you own</h2>
              <p className="mt-1 text-small text-text-soft">Get a suggested AM and PM order for products on your shelf.</p>
            </div>
          </div>
          <Button onClick={() => void suggestFromShelf()} disabled={suggesting}>
            {suggesting ? "Building suggestions…" : "Suggest my routines"}
          </Button>
        </section>
      )}
      {suggestionReason && <p className="mb-5 max-w-prose text-small text-text-muted">{suggestionReason}</p>}

      <div className="mb-5 flex gap-2 sm:hidden" role="group" aria-label="Routine">
        {TYPES.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setActive(id)} aria-pressed={active === id} className={pillClass(active === id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {TYPES.map(({ id, label }) => {
          const routine = routines[id];
          const routineSteps = steps[id] ?? [];
          return (
            <section key={id} className={`glass rounded-card p-5 md:p-6 ${active !== id ? "hidden sm:block" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-title font-semibold text-text">{TITLES[id]}</h2>
                <span className="text-small text-text-muted">{routineSteps.length} {routineSteps.length === 1 ? "step" : "steps"}</span>
              </div>
              {routine && (
                <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-small text-text-soft">
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={routine.is_public}
                    onChange={async (event) => {
                      const isPublic = event.target.checked;
                      setRoutines((prev) => ({ ...prev, [id]: { ...prev[id], is_public: isPublic } }));
                      try { await setRoutineVisibility(routine.id, isPublic); }
                      catch { setError("Couldn't update routine visibility."); void load(); }
                    }}
                  />
                  Show this routine on my public profile
                </label>
              )}

              <ol
                className="mt-4 space-y-2"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const from = Number(event.dataTransfer.getData("text/plain"));
                  const to = Number((event.target as HTMLElement).closest("li")?.dataset.index);
                  if (Number.isInteger(from) && Number.isInteger(to)) void reorder(from, to);
                }}
              >
                {routineSteps.map((step, index) => (
                  <li
                    key={step.id}
                    data-index={index}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                    className="glass-strong flex items-center gap-3 rounded-tile p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-dim text-small font-semibold text-accent">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-label uppercase text-text-muted">{step.step_name || "Step"}</p>
                      <p className="clamp-1 text-small font-medium text-text">
                        {step.inventory_items ? `${step.inventory_items.brand} ${step.inventory_items.product}` : "Add a product from your shelf"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className={ICON_BUTTON} disabled={index === 0} aria-label={`Move step ${index + 1} up`} onClick={() => void reorder(index, index - 1)}>↑</button>
                      <button type="button" className={ICON_BUTTON} disabled={index === routineSteps.length - 1} aria-label={`Move step ${index + 1} down`} onClick={() => void reorder(index, index + 1)}>↓</button>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} hover:border-danger hover:text-danger`}
                        aria-label={`Remove step ${index + 1}`}
                        onClick={async () => {
                          try {
                            await removeRoutineStep(step.id);
                            setSteps((prev) => ({ ...prev, [id]: routineSteps.filter((item) => item.id !== step.id) }));
                          } catch { setError("Couldn't remove that step."); }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {routineSteps.length === 0 && (
                <p className="mt-4 rounded-tile border border-dashed border-line-strong bg-white/40 p-6 text-center text-small text-text-muted">
                  Add products in the order you use them.
                </p>
              )}

              <div className="mt-5 border-t border-line-strong pt-5">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select
                    aria-label={`Choose a shelf product for ${TITLES[id]}`}
                    className={FIELD}
                    value={id === active ? selectedProduct : ""}
                    onChange={(event) => { setActive(id); setSelectedProduct(event.target.value); }}
                  >
                    <option value="">Add from your shelf…</option>
                    {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <Button size="sm" variant="secondary" disabled={id !== active || !selectedProduct} onClick={() => void insertStep(inventory.find((item) => item.id === selectedProduct) ?? null)}>
                    Add product
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    aria-label={`Name a step for ${TITLES[id]}`}
                    className={FIELD}
                    placeholder="Or type a step, such as Cleanser"
                    value={id === active ? customStep : ""}
                    onChange={(event) => { setActive(id); setCustomStep(event.target.value); }}
                  />
                  <Button size="sm" variant="ghost" disabled={id !== active || !customStep.trim()} onClick={() => void insertStep(null)}>
                    Add step
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {error && <p className="mt-4 text-small text-danger" role="alert">{error}</p>}
    </Page>
  );
}
