"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { LevelPill } from "@/components/eval/charts";
import { MethodSheet, type Method } from "@/components/find-shade/MethodSheet";
import { SearchMethod } from "@/components/find-shade/SearchMethod";
import { ResultCard } from "@/components/find-shade/ResultCard";
import { useToneProfile } from "@/hooks/useToneProfile";
import { MST_HEX } from "@/lib/eval";
import { rankShades, shadesFor, type Product, type ShadeMatch } from "@/lib/shades";
import { pillClass } from "@/components/ui/PillGroup";

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export default function FindShadePage() {
  const { profile, ready } = useToneProfile();
  const [pickedLevel, setPickedLevel] = useState<number | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [matches, setMatches] = useState<ShadeMatch[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [sheetOpen, setSheetOpen] = useState(true);

  // The measured reading wins; a picked Monk level is the fallback.
  const skin = useMemo(() => {
    if (profile) return { hex: profile.avgHex, undertone: profile.undertone, approximate: false };
    if (pickedLevel) return { hex: MST_HEX[pickedLevel - 1], undertone: null, approximate: true };
    return null;
  }, [profile, pickedLevel]);

  useEffect(() => {
    if (!product || !skin) return;
    let live = true;
    setStatus("loading");
    shadesFor(product)
      .then((shades) => {
        if (!live) return;
        setMatches(rankShades(shades, skin.hex, skin.undertone));
        setStatus("idle");
        setSheetOpen(false);
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [product, skin]);

  const methods: Method[] = [{ key: "search", label: "Search", icon: SEARCH_ICON, panel: <SearchMethod onPick={setProduct} /> }];

  return (
    <Page width="list">
      <PageHeader
        label="Shade finder"
        title="Your shade, in any product."
        description="Name a foundation and Tinted picks the shade closest to your skin, with the colour distance to show how close."
      />

      {/* ── Whose skin we are matching ─────────────────────────────────── */}
      <section aria-label="Your skin reading" className="rounded-card border border-white/90 bg-[#fffdfa] p-5 shadow-card sm:p-6">
        {!ready ? (
          <div className="h-12 animate-pulse rounded-tile bg-peach/50" />
        ) : profile ? (
          <div className="flex flex-wrap items-center gap-4">
            <span aria-hidden="true" className="h-12 w-12 rounded-full shadow-card ring-2 ring-white" style={{ background: profile.avgHex }} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text">
                Matching to your reading: MST {profile.mstLevel}, {profile.undertone} undertone
              </p>
              <p className="text-small text-text-muted">
                Measured {new Date(profile.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} on this
                device. Readings can be off in poor light;{" "}
                <Link href="/eval" className="text-accent underline-offset-4 hover:underline">
                  see how accurate
                </Link>
                .
              </p>
            </div>
            <Link href="/match" className="text-small font-semibold text-accent underline-offset-4 hover:underline">
              Measure again
            </Link>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-text">No skin reading on this device yet.</p>
            <p className="mt-1 text-small text-text-soft">
              <Link href="/match" className="font-semibold text-accent underline-offset-4 hover:underline">
                Take the shade match
              </Link>{" "}
              for a measured colour, or pick the Monk level closest to you to get a starting point.
            </p>
            <div role="group" aria-label="Monk level" className="mt-4 flex flex-wrap gap-1.5">
              {MST_HEX.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={pickedLevel === i + 1}
                  onClick={() => setPickedLevel(i + 1)}
                  className={pillClass(pickedLevel === i + 1, "min-h-10 px-1.5")}
                >
                  <LevelPill hex={hex} level={i + 1} />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      <div className="mt-8" aria-live="polite">
        {status === "loading" && <div className="h-64 animate-pulse rounded-card bg-peach/50" />}
        {status === "error" && (
          <p className="rounded-card bg-blush p-5 text-small text-blush-ink">Couldn&apos;t load that product&apos;s shades. Try again.</p>
        )}
        {status === "idle" && matches && skin && <ResultCard matches={matches} skinHex={skin.hex} approximate={skin.approximate} />}
        {status === "idle" && product && !skin && (
          <p className="rounded-card bg-peach p-5 text-small text-peach-ink">Pick a Monk level above, or take the shade match, and the shade appears here.</p>
        )}
        {!product && (
          <p className="py-10 text-center text-small text-text-muted">Search for a foundation below to see your shade.</p>
        )}
      </div>

      <MethodSheet
        methods={methods}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        summary={product ? `${product.brand} ${product.product_name}` : "Find a product"}
      />
    </Page>
  );
}
