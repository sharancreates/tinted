"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToneRibbon, MONK_TONES } from "@/components/ui/ToneRibbon";
import { Orb } from "@/components/ui/Orb";
import { Aura } from "@/components/ui/Aura";
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
  const [copied, setCopied] = useState(false);

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

  if (loading) {
    return (
      <Page width="grid">
        <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-card bg-raised" aria-busy="true" />
      </Page>
    );
  }

  if (!profile) {
    return (
      <Page width="prose">
        <div className="glass flex flex-col items-center gap-4 rounded-card p-8 text-center md:p-12">
          <Orb size="lg" />
          <h1 className="text-display font-semibold text-text">This profile isn&apos;t available</h1>
          <p className="max-w-prose text-text-soft">{error || "The owner may have made it private or changed their username."}</p>
          <Link href="/match" className="mt-2 inline-flex min-h-11 items-center text-small font-medium text-accent underline-offset-4 hover:underline">
            Find your own shade <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </Page>
    );
  }

  const toneHex = profile.monk_tone ? MONK_TONES[profile.monk_tone - 1] : undefined;

  return (
    <Page width="grid">
      <header className="glass mx-auto mb-10 flex w-full max-w-3xl flex-col items-center gap-3 overflow-hidden rounded-card px-6 pb-8 pt-10 text-center">
        <Orb tone={toneHex} size="lg" />
        <p className="mt-2 text-label uppercase text-accent">Tinted profile</p>
        <h1 className="text-[clamp(2rem,3.5vw,2.75rem)] font-semibold leading-tight tracking-[-0.02em] text-text">{profile.display_name}</h1>
        <p className="-mt-1 text-small text-text-muted">@{profile.username}</p>
        {profile.bio && <p className="max-w-prose text-text-soft">{profile.bio}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {profile.monk_tone && <Badge tone="neutral">Monk level {profile.monk_tone}</Badge>}
          {profile.undertone && <Badge tone="neutral">{profile.undertone} undertone</Badge>}
        </div>
        {profile.monk_tone && (
          <div className="mt-2 w-full max-w-md">
            <ToneRibbon active={profile.monk_tone} size="sm" label={`Monk Skin Tone level ${profile.monk_tone}`} />
          </div>
        )}
        <Button
          className="mt-3"
          variant="secondary"
          size="sm"
          onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); }}
        >
          {copied ? "Link copied" : "Copy profile link"}
        </Button>
      </header>

      {routines.length > 0 && (
        <section className="mx-auto mb-12 w-full max-w-3xl">
          <p className="text-label uppercase text-accent">Routines</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {routines.map((routineSteps) => (
              <article key={routineSteps[0]?.routine_id} className="glass rounded-card p-5 md:p-6">
                <h2 className="text-heading font-semibold text-text">{routineSteps[0]?.routine_title}</h2>
                <ol className="mt-4 space-y-3">
                  {routineSteps.map((step) => (
                    <li key={`${step.routine_id}-${step.step_order}`} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-dim text-small font-semibold text-accent">{step.step_order + 1}</span>
                      <div className="min-w-0">
                        <p className="text-label uppercase text-text-muted">{step.step_name}</p>
                        {step.product && <p className="text-small font-medium text-text">{step.brand} {step.product}{step.shade ? ` · ${step.shade}` : ""}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-5">
          <p className="text-label uppercase text-accent">Public shelf</p>
          <h2 className="mt-1 text-display font-semibold text-text">Products in rotation</h2>
        </div>
        {groupedProducts.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong bg-raised/40 p-8 text-center text-small text-text-muted">No products are public yet.</p>
        ) : groupedProducts.map(([category, categoryProducts]) => (
          <div key={category} className="mb-10">
            <h3 className="mb-3 text-heading font-semibold capitalize text-text">{category}</h3>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categoryProducts.map((product) => {
                const key = `${product.brand}|${product.product}|${product.shade ?? ""}`;
                const isSaved = saved.includes(key);
                return (
                  <li key={key} className="glass flex flex-col overflow-hidden rounded-card p-2">
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-tile bg-swatch-ground">
                      {product.image_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={product.image_url} alt="" className="h-full w-full object-contain p-4" loading="lazy" />
                        </>
                      ) : product.hex ? (
                        <span className="h-16 w-16 rounded-full border-4 border-white shadow-card" style={{ backgroundColor: product.hex }} />
                      ) : (
                        <Aura variant="vanity" className="aura-thumb absolute inset-0 rounded-none border-0" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
                      <p className="text-label uppercase text-text-muted">{product.brand}</p>
                      <p className="mt-1 clamp-2 text-small font-medium text-text">{product.product}</p>
                      {product.shade && (
                        <p className="mt-1 flex items-center gap-1.5 text-small text-text-soft">
                          {product.hex && <span aria-hidden="true" className="h-3 w-3 rounded-full border border-line-strong" style={{ backgroundColor: product.hex }} />}
                          {product.shade}
                        </p>
                      )}
                      <Button className="mt-auto" variant="ghost" size="sm" disabled={isSaved} onClick={() => void save(product)}>
                        {isSaved ? "Saved to wishlist" : "Save to my shelf"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      {error && <p className="mt-4 text-small text-danger" role="alert">{error}</p>}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </Page>
  );
}
