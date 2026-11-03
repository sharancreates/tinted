"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE, entranceGroup, entranceItem } from "@/lib/motion";
import { Badge } from "@/components/ui/Badge";
import { Aura } from "@/components/ui/Aura";
import { Orb } from "@/components/ui/Orb";
import { pillClass } from "@/components/ui/PillGroup";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/ui/ProductCard";
import { AddRecommendationToShelf } from "@/components/vanity/AddRecommendationToShelf";
import { ShadeSwatch } from "@/components/ui/ShadeSwatch";
import { Tabs } from "@/components/ui/Tabs";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { useProductImages } from "@/hooks/useProductImages";
import { saveToneProfile } from "@/lib/toneProfile";
import {
  API_URL,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  imageKey,
  type AnalyzeResult,
  type CategoryKey,
  type Product,
} from "@/lib/api";

type FoundationMatch = {
  brand: string;
  name: string;
  shade: string;
  price_tier: string;
  match_reason: string;
};

function undertoneTone(undertone: string): {
  hex: string;
  description: string;
} {
  const value = undertone.toLowerCase();
  if (value.includes("warm"))
    return {
      hex: "#9A5B18",
      description:
        "Golden and peach tones sit closest to your skin; silver jewellery can read cold against it.",
    };
  if (value.includes("cool"))
    return {
      hex: "#2F6E90",
      description:
        "Pink and blue-based tones suit you; yellow-heavy foundations tend to look sallow.",
    };
  return {
    hex: "#82a682",
    description:
      "You sit between warm and cool, so most shade families work. Match on depth first.",
  };
}

export default function ResultsScreen({
  results,
  onReset,
}: {
  results: AnalyzeResult;
  onReset: () => void;
}) {
  const [category, setCategory] = useState<CategoryKey>("foundation");
  const [showDetail, setShowDetail] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState<number | null>(null);
  const [foundInput, setFoundInput] = useState("");
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<FoundationMatch[] | null>(null);

  const detectedLevel = parseInt(results.monk_scale.split("-")[1], 10);
  const mstLevel = overrideLevel ?? detectedLevel;

  // Persist so other routes can use the measurement.
  // Saves the override, not the raw detection: if the user corrected us, their
  // correction is the better answer everywhere else too.
  useEffect(() => {
    saveToneProfile({
      mstLevel,
      undertone: results.undertone,
      avgHex: results.avg_hex,
    });
  }, [mstLevel, results.undertone, results.avg_hex]);
  const undertone = undertoneTone(results.undertone);

  const allProducts = useMemo(
    () =>
      CATEGORY_ORDER.flatMap(
        (key) => (results.recommendations?.[key] as Product[] | undefined) ?? [],
      ),
    [results.recommendations],
  );

  const tabs = useMemo(
    () =>
      CATEGORY_ORDER.filter(
        (key) => (results.recommendations?.[key]?.length ?? 0) > 0,
      ).map((key) => ({
        id: key,
        label: CATEGORY_LABELS[key],
        count: results.recommendations?.[key]?.length ?? 0,
      })),
    [results.recommendations],
  );

  const picks = (results.recommendations?.[category] as Product[]) ?? [];
  const reduced = useReducedMotion() ?? false;
  const item = entranceItem(reduced);
  // The hero is painted from the measured colour itself, lifted toward white
  // so ink stays readable on it.
  const hex = results.avg_hex;
  const heroTones: [string, string, string, string] = [
    `color-mix(in srgb, ${hex} 16%, #ffffff)`,
    `color-mix(in srgb, ${hex} 34%, #f4b6c8)`,
    `color-mix(in srgb, ${hex} 30%, #d9c7f2)`,
    `color-mix(in srgb, ${hex} 28%, #fbe3cf)`,
  ];
  const topShade = results.matched_shades[0];

  // Resolve the visible category first, then everything else. One batch of 27
  // meant no card painted until the slowest lookup finished — about five
  // seconds of empty grid. A category is four products, so the cards the user
  // is actually looking at fill in around a second, and switching tabs is
  // instant once the background pass lands (results are cached server-side).
  const { images } = useProductImages(picks, allProducts);

  const runFoundationMatch = useCallback(async () => {
    const input = foundInput.trim();
    if (!input || matching) return;
    setMatching(true);
    setMatches(null);
    try {
      const response = await fetch(`${API_URL}/match-foundation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shade_input: input,
          mst_level: mstLevel,
          undertone: results.undertone,
        }),
      });
      const data = await response.json().catch(() => ({ matches: [] }));
      setMatches(data.matches ?? []);
    } catch {
      setMatches([]);
    } finally {
      setMatching(false);
    }
  }, [foundInput, matching, mstLevel, results.undertone]);

  return (
    <Page width="grid">
      <motion.div
        variants={entranceGroup(reduced)}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        {/* ── The measurement is the hero ─────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <motion.header variants={item} className="min-w-0">
            <Aura tones={heroTones} className="flex h-full flex-col gap-6 p-6 shadow-card md:p-8">
              <p className="text-label uppercase text-text">Your measured tone</p>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <Orb tone={hex} size="xl" settle label={`Measured skin colour ${hex}`} />
                <div className="min-w-0">
                  <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] font-semibold capitalize leading-none tracking-[-0.03em] text-text">
                    {results.undertone}
                  </h1>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-text">
                    <span className="text-heading font-semibold text-text">Monk tone {mstLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-small uppercase tabular-nums">{hex}</span>
                    {topShade && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-small">closest shade {topShade.shade_name}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <ToneRibbon
                active={mstLevel}
                label={`Monk Skin Tone scale. Your measurement is level ${mstLevel} of 10.`}
              />
              <p className="max-w-prose text-text">{undertone.description}</p>
              <div className="mt-auto flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDetail((open) => !open)}
                  aria-expanded={showDetail}
                  aria-controls="match-detail"
                >
                  {showDetail ? "Hide the details" : "How we got this"}
                </Button>
                <Button variant="ghost" size="sm" onClick={onReset}>
                  Start over
                </Button>
              </div>
            </Aura>
          </motion.header>

          {/* ── Shade range: on white, so nothing tints the chips ────────── */}
          {results.matched_shades.length > 0 && (
            <motion.section variants={item} aria-labelledby="shades-heading" className="tone-panel flex flex-col gap-4 rounded-card p-5">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 id="shades-heading" className="text-heading font-semibold text-text">Your shade range</h2>
                <span className="text-small text-text-muted">{results.matched_shades.length} matches</span>
              </div>
              <ul className="flex flex-col gap-3">
                {results.matched_shades.map((shade) => (
                  <li key={shade.shade_name} className="rounded-tile bg-swatch-ground p-3 shadow-card">
                    <ShadeSwatch hex={shade.hex} name={shade.shade_name} detail={shade.description} />
                    {shade.closeness && (
                      // delta-E 2.3 is the just-noticeable difference, so
                      // "close" genuinely means close.
                      <p className="mt-2 flex items-baseline gap-2 pl-[3.75rem]">
                        <span className="text-label uppercase text-accent">{shade.closeness}</span>
                        {typeof shade.delta_e === "number" && (
                          <span className="text-label tabular-nums text-text-muted">ΔE {shade.delta_e.toFixed(1)}</span>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="px-1 text-small text-text-muted">
                Three shades, not one: lighting adds real uncertainty, and a range is the honest answer.
              </p>
            </motion.section>
          )}
        </div>

        {/* ── The reasoning, on demand ─────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {showDetail && (
            <motion.section
              key="detail"
              id="match-detail"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: reduced ? DURATION.reduced : DURATION.base, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: DURATION.reduced, ease: "easeIn" } }}
              className="glass rounded-card p-6 md:p-8"
            >
              <h2 className="text-heading font-semibold text-text">How the match was made</h2>
              <p className="mt-2 max-w-prose text-small leading-relaxed text-text-soft">
                We sampled {results.pixel_count} skin patches across your face, discarded the ones
                affected by shadow or glare, and averaged the rest to {hex}. That average was
                classified on the Monk Skin Tone scale, and the undertone came from the balance of
                red and yellow in the same sample.
              </p>

              {/* An automated result needs a manual override. */}
              <fieldset className="mt-6 border-t border-line-strong pt-5">
                <legend className="text-label uppercase text-text-muted">Not quite right?</legend>
                <p className="mt-2 text-small text-text-soft">
                  Lighting fools this more often than we would like. Set your own level and the
                  foundation matcher will use it.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={level === mstLevel}
                      aria-label={`Monk skin tone level ${level}${level === detectedLevel ? " (detected)" : ""}`}
                      onClick={() => setOverrideLevel(level === detectedLevel ? null : level)}
                      className={pillClass(level === mstLevel, "min-w-11 px-0 tabular-nums")}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {overrideLevel !== null && (
                  <p className="mt-3 text-small text-warn">
                    Using level {overrideLevel} instead of the detected {detectedLevel}.{" "}
                    <button type="button" onClick={() => setOverrideLevel(null)} className="cursor-pointer underline hover:text-text">
                      Reset
                    </button>
                  </p>
                )}
              </fieldset>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Recommendations ──────────────────────────────────────────── */}
        {tabs.length > 0 ? (
          <motion.section variants={item} aria-labelledby="recs-heading" className="glass flex flex-col gap-5 rounded-card p-5 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="recs-heading" className="text-display font-semibold text-text">Recommended for you</h2>
              <span className="text-small text-text-muted">
                {allProducts.length} products · {tabs.length} categories
              </span>
            </div>
            <Tabs
              tabs={tabs}
              activeId={category}
              onChange={(id) => setCategory(id as CategoryKey)}
              label="Product categories"
            />
            <div role="tabpanel" id={`panel-${category}`} aria-labelledby={`tab-${category}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={category}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: DURATION.fast, ease: EASE } }}
                  exit={{ opacity: 0, transition: { duration: DURATION.reduced, ease: "easeIn" } }}
                  className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {picks.map((product, index) => {
                    const imageUrl = images[imageKey(product.brand, product.product)];
                    return <div key={`${product.brand}-${product.product}`} className="flex flex-col gap-2">
                      <ProductCard
                        index={index}
                        product={{
                          ...product,
                          // Absent key = still resolving; null = resolved to no photo.
                          imageUrl,
                        }}
                      />
                      <AddRecommendationToShelf brand={product.brand} product={product.product} shade={product.shade} category={category} imageUrl={imageUrl} />
                    </div>;
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        ) : (
          <motion.section variants={item} className="glass rounded-card p-6 md:p-8">
            <h2 className="text-heading font-semibold text-text">No product picks this time</h2>
            <p className="mt-2 text-small text-text-soft">
              Your shade match above still stands. Product picks come from a separate step that
              didn&apos;t return, so try again in a moment.
            </p>
          </motion.section>
        )}

        {/* ── Foundation matcher ──────────────────────────────────────── */}
        <motion.section variants={item} aria-labelledby="matcher-heading" className="glass flex flex-col gap-4 rounded-card p-6 md:p-8">
          <div>
            <h2 id="matcher-heading" className="text-heading font-semibold text-text">
              Already know a foundation that fits?
            </h2>
            <p className="mt-1 max-w-prose text-small text-text-soft">
              Name one that matches you and we&apos;ll find the equivalent in other brands.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="foundation-input" className="sr-only">Foundation brand and shade</label>
            <input
              id="foundation-input"
              type="text"
              value={foundInput}
              onChange={(event) => setFoundInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runFoundationMatch()}
              placeholder="e.g. Maybelline Fit Me 220"
              className="min-h-12 flex-1 rounded-pill border border-white bg-raised px-5 text-text shadow-card placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <Button onClick={runFoundationMatch} disabled={matching || !foundInput.trim()}>
              {matching ? "Matching…" : "Find matches"}
            </Button>
          </div>

          {matches !== null && (
            <div role="status">
              {matches.length === 0 ? (
                <p className="text-small text-text-muted">No close equivalents found for that one.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.map((match) => (
                    <div key={`${match.brand}-${match.shade}`} className="glass-strong rounded-tile p-4">
                      <p className="text-label uppercase text-text-muted">{match.brand}</p>
                      <p className="mt-1 font-medium text-text">{match.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone="neutral">{match.shade}</Badge>
                        <span className="text-small text-text-muted">{match.price_tier}</span>
                      </div>
                      {match.match_reason && <p className="mt-2 text-small text-text-soft">{match.match_reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.section>
      </motion.div>
    </Page>
  );
}
