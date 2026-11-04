"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Aura, type AuraVariant } from "@/components/ui/Aura";
import { ToneCard } from "@/components/ToneCard";
import { HeroSpline } from "@/components/home/HeroSpline";
import { entranceGroup, entranceItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Tile = {
  href: string;
  title: string;
  body: string;
  variant: AuraVariant;
  big?: boolean;
};

const TILES: Tile[] = [
  {
    href: "/match",
    title: "Shade match",
    body: "Upload a photo or use your camera. About a minute.",
    variant: "match",
    big: true,
  },
  { href: "/quiz", title: "Skincare quiz", body: "Seven questions, one routine", variant: "quiz" },
  { href: "/vanity", title: "My vanity", body: "Your shelf and saved looks", variant: "vanity" },
];

const TRUST = [
  {
    heading: "Monk Skin Tone scale",
    body: "Ten measured tones, designed to be more inclusive than the Fitzpatrick scale. Most shade finders fail on deep and neutral skin; this scale takes them seriously.",
  },
  {
    heading: "Says when it's unsure",
    body: "Bad light, motion blur and a turned head corrupt a colour reading. Tinted checks first and tells you which problem it found.",
  },
  {
    heading: "Photos aren't stored",
    body: "It's analysed and discarded. No account is needed to get a result.",
  },
];

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-accent-vivid shadow-card transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out-soft) group-hover:bg-accent-vivid group-hover:text-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </span>
  );
}

/** The example reading on the floating card. Illustrative, and labelled so. */
const SAMPLE = { level: 5, hex: "#d7bd96", undertone: "Warm", shades: ["#e2c4a0", "#d6b48c", "#c9a47c"] };

function Hero({ item }: { item: ReturnType<typeof entranceItem> }) {
  return (
    <section aria-labelledby="hero-heading" className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-0">
      <motion.div variants={item} className="flex flex-col justify-center lg:py-10 lg:pr-14">
        <p className="text-label uppercase text-accent">Foundation matching for every skin tone</p>
        <h1
          id="hero-heading"
          className="mt-4 text-[clamp(3.25rem,7.5vw,6.25rem)] font-semibold leading-[0.92] tracking-[-0.025em] text-text"
        >
          Find your <em className="font-normal italic text-accent">shade.</em>
        </h1>
        <p className="mt-6 max-w-[42ch] text-[1.0625rem] leading-relaxed text-text-soft">
          Tinted measures the colour of your skin from a photo, tells you how confident it is, and matches you to real products.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/match"
            className="group inline-flex min-h-16 items-center gap-3 rounded-pill bg-accent pl-8 pr-3 text-[1.0625rem] font-semibold text-white shadow-card transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-accent-hover hover:shadow-lift motion-safe:hover:-translate-y-0.5"
          >
            Find your shade
            <span
              aria-hidden="true"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/20 transition-transform duration-(--duration-fast) ease-(--ease-out-soft) motion-safe:group-hover:translate-x-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
          <Link href="/quiz" className="text-small font-semibold text-text-soft underline-offset-4 transition-colors duration-(--duration-fast) hover:text-accent hover:underline">
            Or take the two-minute skincare quiz
          </Link>
        </div>
      </motion.div>

      <motion.div variants={item} className="relative -mx-4 min-h-[24rem] sm:mx-0 lg:min-h-[34rem]">
        {/* Full-bleed art: the gradient is always there; the 3D scene, when
            configured, loads over it once the page is idle. */}
        <div className="absolute inset-0 overflow-hidden sm:rounded-window">
          {/* .aura sets position: relative outside Tailwind's layers, so it
              fills this positioned box rather than taking `absolute` itself. */}
          <div className="aura aura-match h-full w-full">
            <HeroSpline />
          </div>
        </div>

        {/* Floating editorial card, overlapping the art's left edge. */}
        <aside
          aria-label="Example reading"
          className="absolute bottom-6 left-6 w-64 rounded-card border border-white/90 bg-[#fffdfa]/95 p-5 shadow-lift backdrop-blur-md transition-transform duration-(--duration-base) ease-(--ease-out-soft) motion-safe:hover:-translate-y-1 lg:-left-12 lg:bottom-12"
        >
          <p className="text-label uppercase text-text-muted">Example reading</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-12 w-12 shrink-0 rounded-full shadow-[inset_-4px_-6px_10px_rgba(0,0,0,0.12),inset_4px_4px_8px_rgba(255,255,255,0.5)]"
              style={{ background: SAMPLE.hex }}
            />
            <div>
              <p className="font-display text-[1.75rem] font-semibold leading-none text-text">MST {SAMPLE.level}</p>
              <p className="mt-1 text-small text-text-soft">{SAMPLE.undertone} undertone</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-line-strong pt-4">
            {SAMPLE.shades.map((hex) => (
              <span key={hex} aria-hidden="true" className="h-6 flex-1 rounded-pill ring-1 ring-black/5" style={{ background: hex }} />
            ))}
          </div>
          <p className="mt-2 text-small text-text-muted">Three closest foundation shades</p>
        </aside>
      </motion.div>
    </section>
  );
}

export function HomeScreen() {
  const reduced = useReducedMotion() ?? false;
  const item = entranceItem(reduced);

  return (
    <motion.div variants={entranceGroup(reduced)} initial="hidden" animate="show" className="flex flex-col gap-14">
      <Hero item={item} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-8">

        <div className="grid gap-4 sm:grid-cols-[1.35fr_1fr] sm:grid-rows-[11.5rem_11.5rem]">
          {TILES.map((tile) => (
            <motion.div key={tile.href} variants={item} className={cn(tile.big && "sm:row-span-2")}>
              <Link
                href={tile.href}
                className="group block h-full rounded-card transition-shadow duration-(--duration-base) ease-(--ease-out-soft) hover:shadow-lift focus-visible:shadow-lift"
              >
                <Aura
                  variant={tile.variant}
                  className={cn("flex h-full flex-col justify-end rounded-card p-6", tile.big ? "min-h-64" : "min-h-44")}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className={cn("font-semibold text-text", tile.big ? "text-display" : "text-title")}>
                        {tile.title}
                      </h2>
                      <p className="mt-1 text-small text-text-soft">{tile.body}</p>
                    </div>
                    <Arrow />
                  </div>
                </Aura>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.section variants={item} aria-labelledby="trust-heading" className="glass rounded-card p-6 md:p-8">
          <h2 id="trust-heading" className="text-heading font-semibold text-text">
            Why the match is worth trusting
          </h2>
          <ul className="mt-5 grid gap-5 md:grid-cols-3">
            {TRUST.map((t) => (
              <li key={t.heading} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-vivid" />
                <div>
                  <h3 className="text-body font-semibold text-text">{t.heading}</h3>
                  <p className="mt-1 text-small text-text-soft">{t.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      <motion.div variants={item} className="flex">
        <ToneCard className="w-full" />
      </motion.div>
      </div>
    </motion.div>
  );
}
