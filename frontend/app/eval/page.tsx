import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfusionMatrix } from "@/components/eval/ConfusionMatrix";
import { HeatGrid, Legend, PairBars, PairTable, type PairRow } from "@/components/eval/charts";
import { report, pct, SERIES, type LightingKey } from "@/lib/eval";

export const metadata: Metadata = {
  title: "Accuracy | Tinted",
  description: "How accurately Tinted reads skin tone across Monk levels and lighting, measured.",
};

const CARD = "rounded-card border border-white bg-white/80 p-5 shadow-card sm:p-7";

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="text-display font-semibold text-text">{title}</h2>
      <p className="mb-6 mt-2 max-w-prose text-small text-text-soft">{kicker}</p>
      {children}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`${CARD} flex flex-col gap-1 !p-5`}>
      <p className="text-small text-text-muted">{label}</p>
      <p className="text-[2.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-text">{value}</p>
      <p className="mt-1 text-small text-text-soft">{note}</p>
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

  return (
    <Page width="grid">
      <PageHeader
        label="Measurement"
        title="How accurate is the match?"
        description="Every scene below went through the same white balance, skin sampling and Monk classifier that run when you upload a photo. Here is where it holds up, where it does not, and what changed because of it."
      />

      <div className="mb-6 rounded-card border border-accent/25 bg-white/70 p-5 text-small text-text-soft sm:p-6">
        <p className="font-semibold text-text">Read this first</p>
        <p className="mt-1 max-w-prose">
          These are {report.meta.scenes.toLocaleString("en-US")} simulated portraits, not photographs of people. Each has a known skin
          colour, lit like a real room, with sensor noise and JPEG compression, so every error is the pipeline&apos;s fault and can be
          traced. Face detection, real skin texture and makeup are not tested here. A study on labelled photographs is the next step, and
          until it runs these numbers are a best case for the colour stages, not a promise about your selfie.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Right level in daylight" value={pct(day.exact_of_all)} note={`${pct(day.within1_of_all)} within one level. Refused photos count as misses.`} />
        <Stat label="Within one level, all four lights" value={pct(report.overall.on.within1_of_all)} note="Warm-bulb refusals pull this down. See below." />
        <Stat
          label="Daylight photos refused"
          value={pct(day.rejection_rate)}
          note={base ? `Was ${pct(base.daylight.rejection_rate)} before this eval found a bug in the exposure check.` : "Too few usable skin patches."}
        />
        <Stat label="Colour error in daylight" value={deFmt(day.mean_delta_e)} note="ΔE 2000 from the true skin colour. Near 2 is hard to see side by side." />
      </div>

      <div className="grid gap-6">
        <Section
          title="Accuracy by lighting"
          kicker="Share of all photos that got the exact Monk level, refusals included. The earlier bars are the pipeline before this evaluation, when its exposure check treated pale skin as blown out."
        >
          <div className="mb-5">
            <Legend items={[{ label: "Before the fix", color: SERIES.before }, { label: "Now", color: SERIES.after }]} />
          </div>
          <PairBars rows={accuracyRows} max={1} format={(v) => pct(v)} labels={{ before: "Before the fix", after: "Now" }} />
          <PairTable rows={accuracyRows} format={(v) => pct(v, 1)} labels={{ before: "Before the fix", after: "Now" }} caption="Exact accuracy of all photos by lighting" />

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {lights.map((l) => (
              <figure key={l.key} className="overflow-hidden rounded-tile border border-white bg-white">
                <Image src={`/eval/${l.key}.jpg`} alt={`A simulated MST 5 portrait under ${l.label.toLowerCase()}`} width={180} height={180} className="aspect-square w-full object-cover" />
                <figcaption className="p-3 text-small">
                  <span className="block font-medium text-text">{l.label}</span>
                  <span className="block text-text-muted">{l.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section
          title="Where the errors land"
          kicker="A wrong answer that is one level off is a different problem from one that is three off, and leaning light is different from leaning deep. Only the matrix shows which."
        >
          <ConfusionMatrix />
        </Section>

        <div className="grid gap-6 2xl:grid-cols-2">
          <Section
            title="By tone and light"
            kicker="Exact answers per Monk level, refusals counted as misses. The lightest three levels are the weak spot under every light."
          >
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
          </Section>

          <Section
            title="What white balance is worth"
            kicker="Average colour error with and without the white balance step. Lower is better. It earns its place in blue shade and costs a little in daylight."
          >
            <div className="mb-5">
              <Legend items={[{ label: "Without", color: SERIES.before }, { label: "With", color: SERIES.after }]} />
            </div>
            <PairBars rows={deltaRows} max={deMax} format={deFmt} labels={{ before: "Without", after: "With" }} />
            <PairTable rows={deltaRows} format={deFmt} labels={{ before: "Without", after: "With" }} caption="Mean colour error by lighting, with and without white balance" />
          </Section>
        </div>

        <Section
          title="The classifier on its own"
          kicker="Before any photo is involved: how far a measured colour can drift before the answer changes. Wide margins mean a forgiving level. MST 1 and 2 sit 5.5 units apart, so a small error flips them."
        >
          <div className="flex flex-col gap-2.5">
            {margins.map((m) => (
              <div key={m.level} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-small tabular-nums text-text-soft">
                  <span aria-hidden="true" className="h-3.5 w-3.5 rounded-[4px] ring-1 ring-black/5" style={{ background: m.hex }} />
                  {m.level}
                </span>
                <span className="flex items-center gap-2 border-l border-line-strong">
                  <span className="h-3 rounded-r-[4px]" style={{ width: `${(m.safe_radius / marginMax) * 100}%`, background: SERIES.after }} />
                  <span className="text-small tabular-nums text-text">{m.safe_radius.toFixed(1)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-small text-text-muted">
            Safe radius in LAB units: half the distance to the nearest other level. Any measurement error smaller than this cannot change the
            answer.
          </p>
        </Section>

        <section className={CARD}>
          <h2 className="text-display font-semibold text-text">What this found</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            <li className="rounded-tile border border-white bg-white p-5">
              <p className="text-label uppercase text-accent">Fixed</p>
              <p className="mt-2 font-semibold text-text">Pale skin was being refused</p>
              <p className="mt-1 text-small text-text-soft">
                The exposure check threw out any skin patch brighter than V 240. The MST 1 to 3 references are V 243 to 247, so healthy pale skin
                read as blown out. It now refuses only when a quarter of a patch is clipped. Daylight refusals went from{" "}
                {pct(base?.daylight.rejection_rate)} to {pct(day.rejection_rate)}.
              </p>
            </li>
            <li className="rounded-tile border border-white bg-white p-5">
              <p className="text-label uppercase text-text-muted">Open</p>
              <p className="mt-2 font-semibold text-text">Warm bulbs beat white balance</p>
              <p className="mt-1 text-small text-text-soft">
                A 2700 K cast tints walls past the &quot;neutral&quot; cutoff, so the correction finds nothing to measure and never runs. Pale faces
                also clip in the red channel and get refused ({pct(on.warm.rejection_rate)} of warm photos). The app asks for softer light, which is
                right, but a better estimator is the next fix.
              </p>
            </li>
            <li className="rounded-tile border border-white bg-white p-5">
              <p className="text-label uppercase text-text-muted">Open</p>
              <p className="mt-2 font-semibold text-text">Pale skin votes on its own correction</p>
              <p className="mt-1 text-small text-text-soft">
                MST 1 to 3 are low enough in saturation to pass as neutral, so in a close selfie the skin nudges white balance toward grey. That is
                why colour error rises from {deFmt(off.daylight.mean_delta_e)} to {deFmt(day.mean_delta_e)} in daylight with the step on.
              </p>
            </li>
          </ul>
        </section>

        <section className={`${CARD} text-small text-text-soft`}>
          <h2 className="text-display font-semibold text-text">Method</h2>
          <ul className="mt-4 grid max-w-prose list-disc gap-2 pl-5">
            <li>
              {report.meta.subjects_per_level} simulated people per Monk level, each with skin jittered around the level&apos;s reference colour.
              The label is the level that colour reads as before any light touches it.
            </li>
            <li>
              Each is photographed under four lights. Colour casts come from the black body curve with half the cast left after the phone&apos;s
              own correction. Low light is a third of the light brightened 2.6 times, noise included. Then a highlight shoulder, 8 bit encoding
              and JPEG at quality {report.meta.jpeg_quality}.
            </li>
            <li>A quarter of scenes have a saturated wall, which leaves white balance little to work with, like a painted bedroom.</li>
            <li>
              The production code does the rest: neutral pixel white balance, the 17 cheek and forehead patches with their quality gate, the
              trimmed mean and the nearest Monk reference in LAB.
            </li>
            <li>
              Reproduce it with <code className="rounded-[4px] bg-black/5 px-1.5 py-0.5 text-text">python eval/pipeline_sim.py</code> in{" "}
              <code className="rounded-[4px] bg-black/5 px-1.5 py-0.5 text-text">backend/</code>. Seed {report.meta.seed}, generated{" "}
              {report.meta.generated}.
            </li>
          </ul>
          <p className="mt-5">
            <Link href="/match" className="font-semibold text-accent underline-offset-4 hover:underline">
              Try the shade match
            </Link>
          </p>
        </section>
      </div>
    </Page>
  );
}
