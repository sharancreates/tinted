"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { addInventoryItem } from "@/lib/vanity";
import { cn } from "@/lib/utils";
import type { ShadeMatch } from "@/lib/shades";

/** Confidence wording and colour from ΔE: the number is the evidence. */
function confidence(deltaE: number): { label: string; tone: string } {
  if (deltaE < 2.3) return { label: "Strong match", tone: "bg-sage text-sage-ink" };
  if (deltaE < 5) return { label: "Good match", tone: "bg-peach text-peach-ink" };
  if (deltaE < 10) return { label: "Loose match", tone: "bg-lavender text-lavender-ink" };
  return { label: "No close shade", tone: "bg-blush text-blush-ink" };
}

export function ResultCard({
  matches,
  skinHex,
  approximate,
}: {
  matches: ShadeMatch[];
  skinHex: string;
  /** The skin colour came from a picked Monk level, not a measurement. */
  approximate: boolean;
}) {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const best = matches[0];
  if (!best) return null;
  const conf = confidence(best.deltaE);

  const save = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setState("saving");
    try {
      await addInventoryItem(
        {
          brand: best.brand,
          product: best.product_name,
          shade: best.shade_name,
          category: "foundation",
          hex: best.shade_hex,
          url: null,
          price_cents: null,
          notes: `Matched on Tinted: ΔE ${best.deltaE.toFixed(1)} from your skin reading.`,
          status: "wishlist",
        },
        user.id,
      );
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-lift">
      <div className="grid gap-6 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-8">
        {/* Shade disc, with the skin reading tucked against it for comparison. */}
        <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full shadow-[inset_-10px_-14px_24px_rgba(0,0,0,0.14),inset_8px_10px_18px_rgba(255,255,255,0.35)]"
            style={{ background: best.shade_hex }}
          />
          <span
            aria-hidden="true"
            title="Your skin reading"
            className="absolute -bottom-1 -right-1 h-14 w-14 rounded-full border-4 border-surface shadow-card"
            style={{ background: skinHex }}
          />
        </div>

        <div>
          <p className="text-label uppercase text-text-muted">
            {best.brand} · {best.product_name}
          </p>
          <h2 className="mt-2 text-[clamp(2.25rem,5vw,3.25rem)] font-semibold leading-none text-text">{best.shade_name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-pill px-3 py-1 text-small font-semibold", conf.tone)}>{conf.label}</span>
            <span className="rounded-pill border border-line-strong px-3 py-1 text-small tabular-nums text-text-soft">
              ΔE {best.deltaE.toFixed(1)} · {best.description}
            </span>
            {best.undertone && <span className="rounded-pill border border-line-strong px-3 py-1 text-small text-text-soft">{best.undertone} undertone</span>}
          </div>
          <p className="mt-3 max-w-prose text-small text-text-muted">
            ΔE is the colour distance between the shade and your skin reading; under 2.3 is hard to tell apart.
            {approximate && " Your skin colour here is the Monk reference for the level you picked, so treat this as a starting point."}
          </p>
        </div>
      </div>

      {matches.length > 1 && (
        <div className="border-t border-line-strong px-6 py-5 sm:px-8">
          <p className="text-small font-semibold text-text">Next closest</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {matches.slice(1, 4).map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-pill bg-raised py-1.5 pl-1.5 pr-3.5 text-small">
                <span aria-hidden="true" className="h-6 w-6 rounded-full ring-1 ring-black/5" style={{ background: m.shade_hex }} />
                <span className="font-medium text-text">{m.shade_name}</span>
                <span className="tabular-nums text-text-muted">ΔE {m.deltaE.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-strong bg-raised px-6 py-4 sm:px-8">
        <p className="text-small text-text-muted">Shade colours are approximations of the product, not manufacturer data.</p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || state === "saving" || state === "saved"}
          className="inline-flex min-h-12 items-center rounded-pill bg-accent px-6 font-semibold text-bg transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-accent-hover hover:shadow-lift disabled:opacity-60 motion-safe:enabled:hover:-translate-y-0.5"
        >
          {state === "saved" ? "Saved to your wishlist" : state === "saving" ? "Saving…" : "Save to shelf"}
        </button>
        {state === "error" && (
          <p role="alert" className="w-full text-right text-small text-danger">
            Couldn&apos;t save. Try again.
          </p>
        )}
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </article>
  );
}
