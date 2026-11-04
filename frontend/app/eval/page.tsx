import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { ConfusionMatrix } from "@/components/eval/ConfusionMatrix";
import { HeatGrid, LevelPill, Legend, PairBars, PairTable, type PairRow } from "@/components/eval/charts";
import { cn } from "@/lib/utils";
import { report, pct, SERIES, type LightingKey } from "@/lib/eval";

export const metadata: Metadata = {
  title: "Accuracy | Tinted",
  description: "How accurately Tinted reads skin tone across Monk levels and lighting, measured.",
};

const CARD = "rounded-card border border-white/90 bg-[#fffdfa] p-5 shadow-card sm:p-8";

/** Each lighting condition wears one category pastel, everywhere it appears. */
const LIGHT_TINT: Record<LightingKey, string> = {
  daylight: "bg-sky",
  warm: "bg-peach",
  cool: "bg-lavender",
  low: "bg-sage",
};

function Section({ n, title, deck, children, className }: { n: string; title: string; deck: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-6", className)}>
      <header className="grid max-w-2xl gap-2">
        <p className="text-label uppercase text-accent">{n}</p>
        <h2 className="text-[clamp(1.75rem,3vw,2.375rem)] font-semibold leading-[1.1] text-text">{title}</h2>
        <p className="text-text-soft">{deck}</p>
      </header>
      {children}
    </section>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="group border-t border-line-strong pt-5">
      <p className="font-display text-[clamp(3.5rem,6.5vw,5.5rem)] font-semibold leading-[0.9] tracking-[-0.02em] tabular-nums text-text transition-colors duration-(--duration-fast) ease-(--ease-out-soft) group-hover:text-accent">
        {value}
      </p>
      <p className="mt-4 font-semibold text-text">{label}</p>
      <p className="mt-1 max-w-[30ch] text-small text-text-soft">{note}</p>
    </div>
  );
}

export default function EvalPage() {
  const on = report.by_lighting.on;
  const off = report.by_lighting.off;
  const base = report.baseline?.by_lighting;
  const lights = report.lighting;
  const day = on.daylight;

  const accuracyRows: PairRow[] = lights.map((l) => ({
    key: l.key,
    label: l.label,
    sub: `${pct(on[l.key].rejection_rate)} refused`,
    before: base?.[l.key].exact_of_all ?? null,
    after: on[l.key].exact_of_all,
  }));

  const deltaRows: PairRow[] = lights.map((l) => ({
    key: l.key,
    label: l.label,
    before: off[l.key].mean_delta_e,
    after: on[l.key].mean_delta_e,
  }));
  const deMax = Math.ceil(Math.max(...deltaRows.flatMap((r) => [r.before ?? 0, r.after ?? 0])));
  const deFmt = (v: number | null) => (v == null ? "n/a" : v.toFixed(1));

  // Per level and light, refusals count as misses: the user got no answer.
  const levelCell = (level: number, key: string) => {
    const s = on[key as LightingKey].per_level[level - 1];
    if (s.exact == null || s.rejection_rate == null) return s.n ? 0 : null;
    return s.exact * (1 - s.rejection_rate);
  };

  const margins = report.stage.margins;
  const marginMax = Math.max(...margins.map((m) => m.safe_radius));

  const matrices = Object.fromEntries(
    lights.flatMap((l) =>
      (["on", "off"] as const).map((wb) => {
        const c = report.by_lighting[wb][l.key];
        return [
          `${l.key}|${wb}`,
          { confusion: c.confusion, rowRefused: c.per_level.map((p) => p.rejection_rate), exact: c.exact, within1: c.within1, mean_bias: c.mean_bias },
        ];
      }),
    ),
  );

  return (
    <Page width="grid">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="grid gap-8 pb-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="text-label uppercase text-accent">Measurement</p>
          <h1 className="mt-3 text-[clamp(2.75rem,6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-text">
            How accurate is <em className="font-normal italic text-accent">the match?</em>
          </h1>
        </div>
        <p className="max-w-prose text-text-soft lg:pb-2">
          Every scene below went through the same white balance, skin sampling and Monk classifier that run when you upload a photo. Here is
          where it holds up, where it does not, and what changed because of it.
        </p>
      </header>

      {/* ── Headline figures ─────────────────────────────────────────────── */}
      <div className="grid gap-x-8 gap-y-10 pb-14 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={pct(day.exact_of_all)} label="Right level in daylight" note={`${pct(day.within1_of_all)} within one level. Refused photos count as misses.`} />
        <Stat value={pct(report.overall.on.within1_of_all)} label="Within one level, all lights" note="Warm-bulb refusals pull this down. See section 01." />
        <Stat
          value={pct(day.rejection_rate)}
          label="Daylight photos refused"
          note={base ? `Was ${pct(base.daylight.rejection_rate)} before this eval found a bug in the exposure check.` : "Too few usable skin patches."}
        />
        <Stat value={deFmt(day.mean_delta_e)} label="Colour error in daylight" note="ΔE 2000 from the true skin colour. Near 2 is hard to see side by side." />
      </div>

      {/* ── Honesty note ─────────────────────────────────────────────────── */}
      <aside className="mb-16 grid gap-2 rounded-card bg-peach p-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8 sm:p-8">
        <p className="font-display text-[1.375rem] font-semibold italic leading-tight text-peach-ink">Read this first</p>
        <p className="max-w-prose text-small text-text-soft">
          These are {report.meta.scenes.toLocaleString("en-US")} simulated portraits, not photographs of people. Each has a known skin colour,
          lit like a real room, with sensor noise and JPEG compression, so every error is the pipeline&apos;s fault and can be traced. Face
          detection, real skin texture and makeup are not tested here. A study on labelled photographs is the next step, and until it runs these
          numbers are a best case for the colour stages, not a promise about your selfie.
        </p>
      </aside>

      <div className="grid gap-20">
        <Section
          n="01"
          title="Accuracy by lighting"
          deck="Share of all photos that got the exact Monk level, refusals included. Peach is the pipeline before this evaluation, when its exposure check treated pale skin as blown out."
        >
          <div className={CARD}>
            <div className="mb-4 px-3">
              <Legend items={[{ label: "Before the fix", color: SERIES.before }, { label: "Now", color: SERIES.after }]} />
            </div>
            <PairBars rows={accuracyRows} max={1} format={(v) => pct(v)} labels={{ before: "Before the fix", after: "Now" }} />
            <div className="px-3">
              <PairTable rows={accuracyRows} format={(v) => pct(v, 1)} labels={{ before: "Before the fix", after: "Now" }} caption="Exact accuracy of all photos by lighting" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {lights.map((l) => (
              <figure
                key={l.key}
                className={cn(
                  "group overflow-hidden rounded-card p-2 transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:shadow-lift motion-safe:hover:-translate-y-1",
                  LIGHT_TINT[l.key],
                )}
              >
                <Image
                  src={`/eval/${l.key}.jpg`}
                  alt={`A simulated MST 5 portrait under ${l.label.toLowerCase()}`}
                  width={180}
                  height={180}
                  className="aspect-square w-full rounded-tile object-cover"
                />
                <figcaption className="px-2 pb-2 pt-3">
                  <span className="block font-display text-[1.125rem] font-semibold text-text">{l.label}</span>
                  <span className="mt-0.5 block text-small text-text-soft">{l.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section
          n="02"
          title="Where the errors land"
          deck="A wrong answer that is one level off is a different problem from one that is three off, and leaning light is different from leaning deep. Only the matrix shows which."
        >
          <div className={CARD}>
            <ConfusionMatrix
              label="Simulated confusion matrix"
              views={lights.map((l) => ({ key: l.key, label: l.label }))}
              variants={[{ key: "on", label: "White balance on" }, { key: "off", label: "White balance off" }]}
              matrices={matrices}
            />
          </div>
        </Section>

        <div className="grid gap-20 2xl:grid-cols-2 2xl:gap-10">
          <Section n="03" title="By tone and light" deck="Exact answers per Monk level, refusals counted as misses. The lightest three levels are the weak spot under every light.">
            <div className={CARD}>
              <HeatGrid
                levels={report.levels}
                columns={lights.map((l) => ({ key: l.key, label: l.label }))}
                value={levelCell}
                format={(v) => (v == null ? "n/a" : `${Math.round(v * 100)}`)}
                caption="Exact accuracy in percent by Monk level and lighting"
                tip={(level, key) => {
                  const s = on[key as LightingKey].per_level[level - 1];
                  return (
                    <>
                      MST {level}, {lights.find((l) => l.key === key)?.label}
                      <br />
                      {pct(s.exact)} exact of answered, {pct(s.rejection_rate)} refused
                    </>
                  );
                }}
              />
            </div>
          </Section>

          <Section
            n="04"
            title="What white balance is worth"
            deck="Average colour error with and without the white balance step. Lower is better. It earns its place in blue shade and costs a little in daylight."
          >
            <div className={CARD}>
              <div className="mb-4 px-3">
                <Legend items={[{ label: "Without", color: SERIES.before }, { label: "With", color: SERIES.after }]} />
              </div>
              <PairBars rows={deltaRows} max={deMax} format={deFmt} labels={{ before: "Without", after: "With" }} />
              <div className="px-3">
                <PairTable rows={deltaRows} format={deFmt} labels={{ before: "Without", after: "With" }} caption="Mean colour error by lighting, with and without white balance" />
              </div>
            </div>
          </Section>
        </div>

        <Section
          n="05"
          title="The classifier on its own"
          deck="Before any photo is involved: how far a measured colour can drift before the answer changes. Wide margins mean a forgiving level. MST 1 and 2 sit 5.5 units apart, so a small error flips them."
        >
          <div className={CARD}>
            <div className="flex flex-col gap-1">
              {margins.map((m) => (
                <div
                  key={m.level}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-4 rounded-tile px-2 py-1.5 transition-colors duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-peach/60"
                >
                  <LevelPill hex={m.hex} level={m.level} />
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 rounded-pill"
                      style={{ width: `${(m.safe_radius / marginMax) * 100}%`, background: `linear-gradient(90deg, #e8955f, ${SERIES.after})` }}
                    />
                    <span className="text-small font-semibold tabular-nums text-text">{m.safe_radius.toFixed(1)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 px-2 text-small text-text-muted">
              Safe radius in LAB units: half the distance to the nearest other level. Any measurement error smaller than this cannot change the
              answer.
            </p>
          </div>
        </Section>

        <Section n="06" title="What this found" deck="One bug fixed because of these numbers, two problems now named and waiting.">
          <ul className="grid gap-4 md:grid-cols-3">
            {[
              {
                tag: "Fixed",
                title: "Pale skin was being refused",
                body: `The exposure check threw out any skin patch brighter than V 240. The MST 1 to 3 references are V 243 to 247, so healthy pale skin read as blown out. It now refuses only when a quarter of a patch is clipped. Daylight refusals went from ${pct(base?.daylight.rejection_rate)} to ${pct(day.rejection_rate)}.`,
              },
              {
                tag: "Open",
                title: "Warm bulbs beat white balance",
                body: `A 2700 K cast tints walls past the "neutral" cutoff, so the correction finds nothing to measure and never runs. Pale faces also clip in the red channel and get refused (${pct(on.warm.rejection_rate)} of warm photos). The app asks for softer light, which is right, but a better estimator is the next fix.`,
              },
              {
                tag: "Open",
                title: "Pale skin votes on its own correction",
                body: `MST 1 to 3 are low enough in saturation to pass as neutral, so in a close selfie the skin nudges white balance toward grey. That is why colour error rises from ${deFmt(off.daylight.mean_delta_e)} to ${deFmt(day.mean_delta_e)} in daylight with the step on.`,
              },
            ].map((f) => (
              <li
                key={f.title}
                className="rounded-card border border-white/90 bg-[#fffdfa] p-6 shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:shadow-lift motion-safe:hover:-translate-y-1"
              >
                <span
                  className={cn(
                    "inline-flex rounded-pill px-3 py-1 text-label uppercase",
                    f.tag === "Fixed" ? "bg-accent text-white" : "border border-line-strong text-text-muted",
                  )}
                >
                  {f.tag}
                </span>
                <p className="mt-4 font-display text-[1.375rem] font-semibold leading-tight text-text">{f.title}</p>
                <p className="mt-2 text-small text-text-soft">{f.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <section className="grid gap-8 border-t border-line-strong pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="text-label uppercase text-accent">Method</p>
            <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.375rem)] font-semibold leading-[1.1] text-text">How it was measured</h2>
          </div>
          <div className="text-small text-text-soft">
            <ul className="grid max-w-prose list-disc gap-2 pl-5 marker:text-accent-vivid">
              <li>
                {report.meta.subjects_per_level} simulated people per Monk level, each with skin jittered around the level&apos;s reference
                colour. The label is the level that colour reads as before any light touches it.
              </li>
              <li>
                Each is photographed under four lights. Colour casts come from the black body curve with half the cast left after the
                phone&apos;s own correction. Low light is a third of the light brightened 2.6 times, noise included. Then a highlight shoulder, 8
                bit encoding and JPEG at quality {report.meta.jpeg_quality}.
              </li>
              <li>A quarter of scenes have a saturated wall, which leaves white balance little to work with, like a painted bedroom.</li>
              <li>
                The production code does the rest: neutral pixel white balance, the 17 cheek and forehead patches with their quality gate, the
                trimmed mean and the nearest Monk reference in LAB.
              </li>
              <li>
                Reproduce it with <code className="rounded-sm bg-peach px-1.5 py-0.5 text-text">python eval/pipeline_sim.py</code> in{" "}
                <code className="rounded-sm bg-peach px-1.5 py-0.5 text-text">backend/</code>. Seed {report.meta.seed}, generated{" "}
                {report.meta.generated}.
              </li>
            </ul>
            <Link
              href="/match"
              className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-accent px-6 font-semibold text-white transition-[background-color,transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-accent-hover hover:shadow-lift motion-safe:hover:-translate-y-0.5"
            >
              Try the shade match
            </Link>
          </div>
        </section>
      </div>
    </Page>
  );
}
