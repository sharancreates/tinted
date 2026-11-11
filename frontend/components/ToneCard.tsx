"use client";

import Link from "next/link";
import { useToneProfile } from "@/hooks/useToneProfile";
import { profileAge } from "@/lib/toneProfile";
import { Orb } from "@/components/ui/Orb";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { cn } from "@/lib/utils";

const NEXT = [
  { href: "/quiz", title: "Build a routine", meta: "Skincare quiz · 2 min", aura: "aura-quiz" },
  { href: "/vanity", title: "Save your shades", meta: "My vanity", aura: "aura-vanity" },
] as const;

/** Compact shortcut rows, in the style of a now-playing card. */
function NextSteps() {
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <p className="text-label uppercase text-text-muted">Next for you</p>
      {NEXT.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="group glass-strong flex items-center gap-3 rounded-pill p-2 pr-3 transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
        >
          <span aria-hidden="true" className={cn("aura aura-thumb h-11 w-11 shrink-0 rounded-full", n.aura)} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-semibold text-text">{n.title}</span>
            <span className="block truncate text-[0.75rem] text-text-muted">{n.meta}</span>
          </span>
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-accent-vivid shadow-card transition-[background-color,color] duration-(--duration-fast) group-hover:bg-accent-vivid group-hover:text-bg"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}

const UNDERTONE_LABEL: Record<string, string> = {
  warm: "warm",
  cool: "cool",
  neutral: "neutral",
  olive: "olive",
};

/**
 * "Your tone": the last reading saved on this device. Before any reading it
 * invites the first match instead of showing an empty slot.
 */
export function ToneCard({ className }: { className?: string }) {
  const { profile, ready } = useToneProfile();

  return (
    <aside
      aria-label="Your tone"
      className={cn(
        "tone-panel dots flex flex-col items-center gap-5 rounded-card px-6 py-8 text-center",
        className,
      )}
    >
      {!ready ? (
        // Same footprint as the filled card, so nothing jumps when it loads.
        <div className="flex min-h-[19rem] w-full flex-col items-center gap-5" aria-busy="true">
          <span className="h-24 w-24 rounded-full bg-raised" />
          <span className="h-6 w-40 rounded-pill bg-raised" />
          <span className="h-3 w-full rounded-pill bg-raised" />
        </div>
      ) : profile ? (
        <>
          <Orb tone={profile.avgHex} size="xl" settle label={`Your measured tone, ${profile.avgHex}`} />
          <h2 className="text-title font-normal text-text">
            Your tone is <span className="font-semibold">Monk {profile.mstLevel},</span>{" "}
            {UNDERTONE_LABEL[profile.undertone] ?? profile.undertone}
          </h2>
          <ToneRibbon
            active={profile.mstLevel}
            className="w-full"
            label={`Monk Skin Tone ${profile.mstLevel} of 10`}
          />
          <dl className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-small">
            <dt className="text-text-muted">Measured colour</dt>
            <dd className="text-right font-semibold uppercase tabular-nums">{profile.avgHex}</dd>
            <dt className="text-text-muted">Undertone</dt>
            <dd className="text-right font-semibold capitalize">{profile.undertone}</dd>
            <dt className="text-text-muted">Measured</dt>
            <dd className="text-right font-semibold">{profileAge(profile)}</dd>
          </dl>
          <NextSteps />
          <Link
            href="/match"
            className="mt-auto inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-text px-6 text-small font-semibold text-bg shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
          >
            Match again
          </Link>
          <p className="text-small text-text-muted">Saved on this device only.</p>
        </>
      ) : (
        <>
          <Orb size="xl" />
          <h2 className="text-title font-normal text-text">
            What&apos;s <span className="font-semibold">your tone?</span>
          </h2>
          <p className="text-small text-text-soft">
            Take a photo and we&apos;ll measure your depth and undertone on the
            ten-point Monk scale. The photo is analysed and discarded.
          </p>
          <ToneRibbon className="w-full" />
          <NextSteps />
          <Link
            href="/match"
            className="mt-auto inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-text px-6 text-small font-semibold text-bg shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
          >
            Find my shade
          </Link>
        </>
      )}
    </aside>
  );
}
