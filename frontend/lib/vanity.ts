"use client";

/**
 * Inventory and routines — "your vanity".
 *
 * Wraps Supabase so components never build queries inline, and so the
 * money handling lives in one place: prices are integer cents everywhere
 * (summing floats drifts), formatted only at the edge.
 */

import { createClient } from "@/lib/supabase";

export type InventoryItem = {
  id: string;
  brand: string;
  product: string;
  shade: string | null;
  category: string | null;
  hex: string | null;
  url: string | null;
  price_cents: number | null;
  currency: string;
  notes: string | null;
  is_finished: boolean;
  status: ProductStatus;
  image_url: string | null;
  purchase_price_cents: number | null;
  purchase_date: string | null;
  opened_date: string | null;
  is_repurchase: boolean;
  is_public: boolean;
  created_at: string;
};

export const PRODUCT_STATUSES = [
  "using", "backup", "wishlist", "panning", "finished", "destash",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  using: "Using", backup: "Backup", wishlist: "Wishlist", panning: "Panning",
  finished: "Finished", destash: "Destash",
};

export type Routine = {
  id: string;
  title: string;
  description: string | null;
  occasion: string | null;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  routine_type?: "look" | "morning" | "evening" | "weekly";
};

export type RoutineItem = {
  id: string;
  routine_id: string;
  inventory_item_id: string | null;
  step_order: number;
  note: string | null;
  step_name?: string | null;
  notes?: string | null;
  /** Joined from inventory when reading your own routine. */
  inventory_items?: InventoryItem | null;
};

export type ReplenishmentAlert = {
  id: string;
  product_id: string;
  user_id: string;
  estimated_lifespan_days: number | null;
  flagged_low: boolean;
  flagged_empty: boolean;
  flagged_at: string | null;
};

export const CATEGORY_LIFESPANS: Record<string, number> = {
  moisturizer: 90, cleanser: 60, serum: 60, sunscreen: 45,
  foundation: 180, mascara: 90, lipstick: 365, toner: 60,
};

export async function listReplenishmentAlerts(): Promise<ReplenishmentAlert[]> {
  const { data, error } = await createClient().from("replenishment_alerts").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function cycleReplenishmentFlag(
  item: InventoryItem,
  current: ReplenishmentAlert | undefined,
  userId: string,
): Promise<ReplenishmentAlert | null> {
  const next = current?.flagged_empty ? "normal" : current?.flagged_low ? "empty" : "low";
  const estimate = current?.estimated_lifespan_days ?? CATEGORY_LIFESPANS[item.category?.toLowerCase() ?? ""] ?? null;
  if (next === "normal") {
    if (current) {
      const { data, error } = await createClient().from("replenishment_alerts")
        .update({ flagged_low: false, flagged_empty: false, flagged_at: null })
        .eq("id", current.id).select().single();
      if (error) throw error;
      return data;
    }
    return null;
  }
  const values = {
    product_id: item.id,
    user_id: userId,
    estimated_lifespan_days: estimate,
    flagged_low: next === "low",
    flagged_empty: next === "empty",
    flagged_at: new Date().toISOString(),
  };
  const { data, error } = await createClient().from("replenishment_alerts")
    .upsert(values, { onConflict: "product_id" }).select().single();
  if (error) throw error;
  return data;
}

export async function updateProductLifespanEstimate(
  item: InventoryItem,
  userId: string,
  days: number | null,
): Promise<ReplenishmentAlert> {
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase.from("replenishment_alerts")
    .select("id").eq("product_id", item.id).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { data, error } = await supabase.from("replenishment_alerts")
      .update({ estimated_lifespan_days: days }).eq("id", existing.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("replenishment_alerts").insert({
    product_id: item.id, user_id: userId, estimated_lifespan_days: days,
  }).select().single();
  if (error) throw error;
  return data;
}

export type NewInventoryItem = Omit<
  InventoryItem,
  "id" | "created_at" | "currency" | "is_finished" | "status" |
  "image_url" | "purchase_price_cents" | "purchase_date" | "opened_date" | "is_repurchase" | "is_public"
> & {
  currency?: string;
  status?: ProductStatus;
  image_url?: string | null;
  purchase_price_cents?: number | null;
  purchase_date?: string | null;
  opened_date?: string | null;
  is_repurchase?: boolean;
  is_public?: boolean;
  is_finished?: boolean;
};

// ── Money ─────────────────────────────────────────────────────────────────────

/** "24.99" | "24,99" | "$24.99" → 2499. Returns null for anything unparseable. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  // Round rather than truncate: 19.999 should be 20.00, not 19.99.
  return Math.round(value * 100);
}

export function formatCents(cents: number | null, currency = "USD"): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    // Whole amounts read better without trailing zeroes in a list of many.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Total, plus how many items had no price — a total that silently ignores
 *  unpriced items is misleading. */
export function totalCents(items: { price_cents: number | null }[]): {
  total: number;
  unpriced: number;
} {
  return items.reduce(
    (acc, item) =>
      item.price_cents === null
        ? { ...acc, unpriced: acc.unpriced + 1 }
        : { ...acc, total: acc.total + item.price_cents },
    { total: 0, unpriced: 0 },
  );
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function listInventory(): Promise<InventoryItem[]> {
  const { data, error } = await createClient()
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addInventoryItem(
  item: NewInventoryItem,
  userId: string,
): Promise<InventoryItem> {
  const { data, error } = await createClient()
    .from("inventory_items")
    .insert({ ...item, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInventoryItem(
  id: string,
  patch: Partial<NewInventoryItem>,
): Promise<void> {
  const { error } = await createClient()
    .from("inventory_items")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await createClient()
    .from("inventory_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Routines ──────────────────────────────────────────────────────────────────

export async function listRoutines(): Promise<Routine[]> {
  const { data, error } = await createClient()
    .from("routines")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type SkincareRoutineType = "morning" | "evening" | "weekly";

export async function getOrCreateSkincareRoutine(
  type: SkincareRoutineType,
  userId: string,
): Promise<Routine> {
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase.from("routines")
    .select("*").eq("user_id", userId).eq("routine_type", type).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const { data, error } = await supabase.from("routines").insert({
    user_id: userId,
    title: type === "morning" ? "Morning routine" : type === "evening" ? "Evening routine" : "Weekly care",
    routine_type: type,
    description: null,
    occasion: null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function listRoutineSteps(routineId: string): Promise<RoutineItem[]> {
  const { data, error } = await createClient().from("routine_items")
    .select("*, inventory_items(*)").eq("routine_id", routineId).order("step_order");
  if (error) throw error;
  return data ?? [];
}

export async function addRoutineStep(
  routineId: string,
  stepName: string,
  productId: string | null,
  stepOrder: number,
): Promise<RoutineItem> {
  const { data, error } = await createClient().from("routine_items").insert({
    routine_id: routineId,
    inventory_item_id: productId,
    step_name: stepName,
    step_order: stepOrder,
  }).select("*, inventory_items(*)").single();
  if (error) throw error;
  return data;
}

export async function addRoutineSteps(
  routineId: string,
  names: string[],
): Promise<void> {
  if (!names.length) return;
  const { error } = await createClient().from("routine_items").insert(names.map((stepName, index) => ({
    routine_id: routineId,
    inventory_item_id: null,
    step_name: stepName,
    step_order: index,
  })));
  if (error) throw error;
}

export async function addLinkedRoutineSteps(
  routineId: string,
  steps: { product_id: string; step_name: string }[],
): Promise<void> {
  if (!steps.length) return;
  const { error } = await createClient().from("routine_items").insert(steps.map((step, index) => ({
    routine_id: routineId,
    inventory_item_id: step.product_id,
    step_name: step.step_name,
    step_order: index,
  })));
  if (error) throw error;
}

export async function removeRoutineStep(stepId: string): Promise<void> {
  const { error } = await createClient().from("routine_items").delete().eq("id", stepId);
  if (error) throw error;
}

export async function moveRoutineStep(steps: RoutineItem[], from: number, to: number): Promise<RoutineItem[]> {
  if (to < 0 || to >= steps.length || from === to) return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const results = await Promise.all(next.map((step, index) => createClient()
    .from("routine_items").update({ step_order: index }).eq("id", step.id)));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return next.map((step, index) => ({ ...step, step_order: index }));
}

export async function createRoutine(
  routine: { title: string; description?: string; occasion?: string },
  userId: string,
): Promise<Routine> {
  const { data, error } = await createClient()
    .from("routines")
    .insert({ ...routine, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRoutineWithItems(
  id: string,
): Promise<{ routine: Routine; items: RoutineItem[] }> {
  const supabase = createClient();
  const [routineResult, itemsResult] = await Promise.all([
    supabase.from("routines").select("*").eq("id", id).single(),
    supabase
      .from("routine_items")
      .select("*, inventory_items(*)")
      .eq("routine_id", id)
      .order("step_order"),
  ]);
  if (routineResult.error) throw routineResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return { routine: routineResult.data, items: itemsResult.data ?? [] };
}

export async function addItemToRoutine(
  routineId: string,
  inventoryItemId: string,
  stepOrder: number,
): Promise<void> {
  const { error } = await createClient().from("routine_items").insert({
    routine_id: routineId,
    inventory_item_id: inventoryItemId,
    step_order: stepOrder,
  });
  if (error) throw error;
}

/**
 * Persists a whole ordering in one round trip.
 *
 * Reordering by writing one row at a time leaves the list briefly inconsistent
 * if a request fails halfway, and a routine whose steps are in the wrong order
 * is worse than one that refused to move.
 */
export async function reorderRoutineItems(
  ordered: { id: string }[],
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map((item, index) =>
      supabase.from("routine_items").update({ step_order: index }).eq("id", item.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function updateRoutine(
  id: string,
  patch: { title?: string; description?: string | null; occasion?: string | null },
): Promise<void> {
  const { error } = await createClient().from("routines").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeRoutineItem(id: string): Promise<void> {
  const { error } = await createClient()
    .from("routine_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setRoutineVisibility(
  id: string,
  isPublic: boolean,
): Promise<void> {
  const { error } = await createClient()
    .from("routines")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await createClient().from("routines").delete().eq("id", id);
  if (error) throw error;
}

// ── Public share ──────────────────────────────────────────────────────────────

export type SharedItem = {
  step_order: number;
  note: string | null;
  brand: string | null;
  product: string | null;
  shade: string | null;
  category: string | null;
  hex: string | null;
  url: string | null;
  price_cents: number | null;
  currency: string | null;
};

export type PublicProfile = {
  username: string;
  display_name: string;
  bio: string | null;
  monk_tone: number | null;
  undertone: string | null;
  is_public?: boolean;
  user_id?: string;
};

export type PublicProduct = {
  username: string;
  brand: string;
  product: string;
  shade: string | null;
  category: string | null;
  hex: string | null;
  image_url: string | null;
  url: string | null;
};

export type PublicRoutineStep = {
  username: string;
  routine_id: string;
  routine_title: string;
  routine_type: string;
  step_order: number;
  step_name: string;
  brand: string | null;
  product: string | null;
  shade: string | null;
  category: string | null;
  hex: string | null;
  image_url: string | null;
};

export async function getMyPublicProfile(): Promise<PublicProfile | null> {
  const { data, error } = await createClient().from("public_profiles").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePublicProfile(profile: Omit<PublicProfile, "user_id"> & { user_id: string }): Promise<PublicProfile> {
  const { data, error } = await createClient().from("public_profiles")
    .upsert(profile, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return data;
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await createClient().from("public_profile_details")
    .select("username, display_name, bio, monk_tone, undertone").eq("username", username).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublicProducts(username: string): Promise<PublicProduct[]> {
  const { data, error } = await createClient().from("public_profile_products").select("*").eq("username", username);
  if (error) throw error;
  return data ?? [];
}

export async function getPublicRoutineSteps(username: string): Promise<PublicRoutineStep[]> {
  const { data, error } = await createClient().from("public_profile_routine_steps")
    .select("*").eq("username", username).order("step_order");
  if (error) throw error;
  return data ?? [];
}

export async function setProductVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await createClient().from("inventory_items").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

/**
 * Reads a published routine by slug. Uses the shared_routine_items view, which
 * exposes only the columns a shared look needs — never the owner's wider
 * inventory, notes or purchase history.
 */
export async function getSharedRoutine(
  slug: string,
): Promise<{ routine: Routine; items: SharedItem[] } | null> {
  const supabase = createClient();
  const { data: routine } = await supabase
    .from("shared_routines")
    .select("id, title, description, occasion, is_public, share_slug, created_at")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!routine) return null;

  const { data: items } = await supabase
    .from("shared_routine_items")
    .select("*")
    .eq("routine_id", routine.id)
    .order("step_order");

  return { routine, items: items ?? [] };
}
