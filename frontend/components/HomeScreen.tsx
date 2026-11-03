"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Aura, type AuraVariant } from "@/components/ui/Aura";
import { ToneCard } from "@/components/ToneCard";
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

export function HomeScreen() {
  const reduced = useReducedMotion() ?? false;
  const item = entranceItem(reduced);

  return (
    <motion.div
      variants={entranceGroup(reduced)}
      initial="hidden"
      animate="show"
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="flex min-w-0 flex-col gap-8">
        <motion.header variants={item} className="flex flex-col gap-2">
          <h1 className="text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-text">
            Find your shade
          </h1>
          <p className="max-w-prose text-text-soft">
            Tinted measures the colour of your skin from a photo, tells you how
            confident it is, and matches you to real products.
          </p>
        </motion.header>

        <div className="grid gap-4 sm:grid-cols-[1.35fr_1fr] sm:grid-rows-[11.5rem_11.5rem]">
          {TILES.map((tile) => (
            <motion.div key={tile.href} variants={item} className={cn(tile.big && "sm:row-span-2")}>
              <Link
                href={tile.href}
                className="group block h-full rounded-tile shadow-card transition-[transform,box-shadow] duration-(--duration-fast) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:shadow-lift"
              >
                <Aura
                  variant={tile.variant}
                  className={cn("flex h-full flex-col justify-end p-6", tile.big ? "min-h-64" : "min-h-44")}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className={cn("font-medium text-text", tile.big ? "text-display" : "text-title")}>
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
    </motion.div>
  );
}
