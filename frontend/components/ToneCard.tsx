"use client";

import Link from "next/link";
import { useToneProfile } from "@/hooks/useToneProfile";
import { profileAge } from "@/lib/toneProfile";
import { Orb } from "@/components/ui/Orb";
import { ToneRibbon } from "@/components/ui/ToneRibbon";
import { cn } from "@/lib/utils";

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
        "glass dots flex flex-col items-center gap-5 rounded-card px-6 py-8 text-center",
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
          <Orb tone={profile.avgHex} size="lg" settle label={`Your measured tone, ${profile.avgHex}`} />
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
          <Link
            href="/match"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-text px-6 text-small font-semibold text-white shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
          >
            Match again
          </Link>
          <p className="text-small text-text-muted">Saved on this device only.</p>
        </>
      ) : (
        <>
          <Orb size="lg" />
          <h2 className="text-title font-normal text-text">
            What&apos;s <span className="font-semibold">your tone?</span>
          </h2>
          <p className="text-small text-text-soft">
            Take a photo and we&apos;ll measure your depth and undertone on the
            ten-point Monk scale. The photo is analysed and discarded.
          </p>
          <ToneRibbon className="w-full" />
          <Link
            href="/match"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-text px-6 text-small font-semibold text-white shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-px hover:shadow-lift"
          >
            Find my shade
          </Link>
        </>
      )}
    </aside>
  );
}
