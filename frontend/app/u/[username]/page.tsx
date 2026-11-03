"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { addInventoryItem, getPublicProfile, getPublicProducts, getPublicRoutineSteps, type PublicProfile, type PublicProduct, type PublicRoutineStep } from "@/lib/vanity";

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [routineSteps, setRoutineSteps] = useState<PublicRoutineStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPublicProfile(username), getPublicProducts(username), getPublicRoutineSteps(username)])
      .then(([publicProfile, shelf, routines]) => {
        if (cancelled) return;
        setProfile(publicProfile);
        setProducts(shelf);
        setRoutineSteps(routines);
      })
      .catch(() => { if (!cancelled) setError("This profile could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, PublicProduct[]>();
    products.forEach((product) => {
      const category = product.category || "Other";
      groups.set(category, [...(groups.get(category) ?? []), product]);
    });
    return [...groups.entries()];
  }, [products]);
  const routines = useMemo(() => {
    const map = new Map<string, PublicRoutineStep[]>();
    routineSteps.forEach((step) => map.set(step.routine_id, [...(map.get(step.routine_id) ?? []), step]));
    return [...map.values()];
  }, [routineSteps]);

  const save = async (product: PublicProduct) => {
    if (!user) { setAuthOpen(true); return; }
    const key = `${product.brand}|${product.product}|${product.shade ?? ""}`;
    try {
      await addInventoryItem({
        brand: product.brand, product: product.product, shade: product.shade,
        category: product.category, hex: product.hex, image_url: product.image_url,
        url: product.url, price_cents: null, notes: `Saved from @${username}'s public profile`,
        status: "wishlist", is_public: false,
      }, user.id);
      setSaved((previous) => [...previous, key]);
    } catch { setError("Couldn't save this product. Please try again."); }
  };

  if (loading) return <Page width="list"><p className="text-text-muted">Loading profile…</p></Page>;
  if (error || !profile) return <Page width="prose"><h1 className="font-display text-display text-text">This profile isn&apos;t available</h1><p className="mt-3 text-text-soft">{error || "The owner may have made it private or changed their username."}</p></Page>;

  return <Page width="grid">
    <header className="mx-auto mb-10 w-full max-w-3xl text-center">
      <p className="text-label uppercase text-accent">Tinted profile</p>
      {profile.monk_tone && <div className="mx-auto mt-6 max-w-xl"><ToneRibbon active={profile.monk_tone} size="hero" label={`Monk Skin Tone level ${profile.monk_tone}`} /></div>}
      <h1 className="mt-6 font-display text-display text-text">{profile.display_name}</h1>
      <p className="mt-1 text-small text-text-muted">@{profile.username}</p>
      {profile.bio && <p className="mx-auto mt-4 max-w-prose text-text-soft">{profile.bio}</p>}
      {profile.undertone && <Badge tone="neutral" className="mt-3">{profile.undertone} undertone</Badge>}
      <div className="mt-5"><Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(window.location.href); }}>Copy profile link</Button></div>
    </header>

    {routines.length > 0 && <section className="mx-auto mb-12 w-full max-w-3xl"><p className="text-label uppercase text-accent">Routines</p><div className="mt-3 grid gap-4 md:grid-cols-2">{routines.map((steps) => <article key={steps[0]?.routine_id} className="rounded-card border border-line bg-surface p-5"><h2 className="font-display text-heading text-text">{steps[0]?.routine_title}</h2><ol className="mt-4 space-y-3">{steps.map((step) => <li key={`${step.routine_id}-${step.step_order}`} className="flex gap-3"><span className="font-display text-accent">{step.step_order + 1}.</span><div><p className="text-label uppercase text-text-muted">{step.step_name}</p>{step.product && <p className="text-small font-medium text-text">{step.brand} {step.product}{step.shade ? ` · ${step.shade}` : ""}</p>}</div></li>)}</ol></article>)}</div></section>}

    <section><div className="mb-4"><p className="text-label uppercase text-accent">Public shelf</p><h2 className="mt-1 font-display text-title text-text">Products in rotation</h2></div>
      {groupedProducts.length === 0 ? <p className="rounded-card border border-dashed border-line p-8 text-center text-small text-text-muted">No products are public yet.</p> : groupedProducts.map(([category, categoryProducts]) => <div key={category} className="mb-8"><h3 className="mb-3 font-display text-heading text-text">{category}</h3><ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{categoryProducts.map((product) => {
        const key = `${product.brand}|${product.product}|${product.shade ?? ""}`;
        return <li key={key} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"><div className="flex aspect-square items-center justify-center bg-swatch-ground" style={product.hex && !product.image_url ? { backgroundColor: product.hex } : undefined}>{product.image_url ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image_url} alt="" className="h-full w-full object-contain" loading="lazy" />
        </> : product.hex ? <span className="h-12 w-12 rounded-full border border-line" /> : <span className="font-display text-display text-text-muted/50">{product.brand.charAt(0)}</span>}</div><div className="flex flex-1 flex-col p-3"><p className="text-label uppercase text-text-muted">{product.brand}</p><p className="mt-1 clamp-2 text-small font-medium text-text">{product.product}</p>{product.shade && <p className="mt-1 text-small text-text-soft">{product.shade}</p>}<Button className="mt-auto pt-3" variant="ghost" size="sm" disabled={saved.includes(key)} onClick={() => void save(product)}>{saved.includes(key) ? "Saved to wishlist" : "Save to My Shelf"}</Button></div></li>;
      })}</ul></div>)}
    </section>
    {error && <p className="mt-4 text-small text-danger" role="alert">{error}</p>}
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
  </Page>;
}
