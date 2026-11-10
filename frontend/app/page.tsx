import Link from "next/link";
import type { Metadata } from "next";
import { Page } from "@/components/ui/Page";
import { ToneRibbon } from "@/components/ui/ToneRibbon";

export const metadata: Metadata = {
  title: "Tinted — find the shade that actually matches you",
  description:
    "Foundation matching that works across the full range of skin tones. Read your depth and undertone from a photo, or take a two-minute skincare quiz.",
};

// Deliberately not a generic three-column feature grid. Each path states what
// it costs the user and what it gives back, because the real question someone
// has on this page is "do I have to upload my face?".
const PATHS = [
  {
    href: "/match",
    eyebrow: "From a photo",
    title: "Find my shade",
    time: "about a minute",
    body: "We read the colour of your skin directly — sampling dozens of small patches, throwing away the ones ruined by shadow or glare, and averaging what's left.",
    gives: "A shade range, an undertone, and products matched to both.",
    primary: true,
  },
  {
    href: "/quiz",
    eyebrow: "No camera needed",
    title: "Build a routine",
    time: "seven questions",
    body: "Answer seven questions about your skin and we'll assemble a routine in application order, with the reason for every step.",
    gives: "A routine you can actually follow, and what each step is for.",
    primary: false,
  },
];

const TRUST = [
  {
    heading: "Built on the Monk Skin Tone scale",
    body: "A ten-point scale designed to be more inclusive than the Fitzpatrick scale it replaced. Most shade finders fail on deep and neutral tones; this is the measurement that takes them seriously.",
  },
  {
    heading: "It tells you when it can't be sure",
    body: "Bad light, motion blur and a turned head all corrupt a colour reading invisibly. Tinted checks before it analyses and says which problem it found, rather than returning a confidently wrong answer.",
  },
  {
    heading: "Your photo isn't stored",
    body: "It's analysed and discarded. Nothing is uploaded to a profile, and there's no account required to get a result.",
  },
];

export default function WelcomePage() {
  return (
    <Page width="grid">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-wash pt-4 md:pt-10">
        <p className="text-label uppercase text-accent">
          Foundation matching for every skin tone
        </p>
        <h1 className="mt-4 max-w-[14ch] font-display text-hero text-text">
          Find the shade that actually matches you.
        </h1>
        <p className="mt-6 max-w-prose text-text-soft md:text-body">
          Most shade finders guess from a photo of your face. Tinted measures the
          colour of your skin, tells you how confident it is, and shows its
          working.
        </p>

        {/* The scale itself as the hero image — the subject of the product,
            not stock photography. */}
        <div className="mt-10">
          <ToneRibbon size="hero" label="The ten-point Monk Skin Tone scale" />
          <div className="mt-3 flex justify-between text-label uppercase text-text-muted">
            <span>MST 1</span>
            <span className="hidden sm:inline">Ten measured tones</span>
            <span>MST 10</span>
          </div>
        </div>
      </section>

      {/* ── The two paths ────────────────────────────────────────────────── */}
      <section
        aria-labelledby="paths-heading"
        className="mt-(--space-section) grid gap-4 md:grid-cols-2"
      >
        <h2 id="paths-heading" className="sr-only">
          Choose how to start
        </h2>
        {PATHS.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className={
              "group flex flex-col rounded-card border p-6 transition-all " +
              "duration-(--duration-base) ease-(--ease-out-soft) " +
              "hover:-translate-y-1 hover:shadow-lift md:p-8 " +
              (path.primary
                ? "border-accent/40 bg-accent-dim hover:border-accent"
                : "border-line bg-surface hover:border-line-strong")
            }
          >
            <p className="text-label uppercase text-accent">{path.eyebrow}</p>
            <h3 className="mt-2 font-display text-display text-text">
              {path.title}
            </h3>
            <p className="mt-1 text-small text-text-muted">{path.time}</p>
            <p className="mt-4 flex-1 text-small leading-relaxed text-text-soft">
              {path.body}
            </p>
            <p className="mt-4 border-t border-line pt-4 text-small text-text">
              {path.gives}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-small font-semibold text-accent transition-transform group-hover:translate-x-0.5">
              Start
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </section>

      {/* ── Why trust it ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="trust-heading"
        className="mt-(--space-section)"
      >
        <h2
          id="trust-heading"
          className="font-display text-display text-text"
        >
          Why the match is worth trusting
        </h2>
        <div className="mt-(--space-block) grid gap-6 md:grid-cols-3">
          {TRUST.map((item, index) => (
            <div key={item.heading}>
              {/* Numbered rather than icon-decorated: icons here would be
                  decoration standing in for content. */}
              <span
                className="font-mono text-label text-accent"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-heading font-semibold text-text">
                {item.heading}
              </h3>
              <p className="mt-2 text-small leading-relaxed text-text-soft">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section aria-labelledby="how-heading" className="mt-(--space-section)">
        <h2 id="how-heading" className="font-display text-display text-text">
          What happens to your photo
        </h2>
        <ol className="mt-(--space-block) grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
          {[
            ["Detect", "468 facial landmarks locate the skin worth sampling."],
            ["Check", "Blur, exposure and head angle, before anything is measured."],
            ["Sample", "Dozens of patches; outliers from shadow and glare discarded."],
            ["Match", "The average is classified, then matched by perceptual colour distance."],
          ].map(([step, detail], index) => (
            <li key={step} className="bg-surface p-5">
              <span
                className="font-mono text-label text-text-muted"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-1.5 font-medium text-text">{step}</p>
              <p className="mt-1 text-small leading-relaxed text-text-muted">
                {detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-small text-text-muted">
          Then it&apos;s discarded. Nothing is stored.
        </p>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="mt-(--space-section) rounded-card border border-line bg-surface p-8 text-center md:p-12">
        <h2 className="font-display text-display text-text">
          Ready when you are.
        </h2>
        <p className="mx-auto mt-3 max-w-prose text-text-soft">
          No account, no email, no stored photo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/match"
            className="inline-flex min-h-12 items-center rounded-pill bg-accent px-8 font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Find my shade
          </Link>
          <Link
            href="/quiz"
            className="inline-flex min-h-12 items-center rounded-pill border border-line-strong px-8 text-text transition-colors hover:border-accent hover:text-accent"
          >
            Take the quiz
          </Link>
        </div>
      </section>
    </Page>
  );
}
