import { stagger, type Transition, type Variants } from "framer-motion";

/**
 * Motion tokens from MASTER.md. One curve, two durations, one stagger.
 * Entrances play once on load; nothing loops.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const DURATION = { fast: 0.22, base: 0.36, reduced: 0.12 } as const;
export const STAGGER = 0.04;

const enter: Transition = { duration: DURATION.base, ease: EASE };
const reducedFade: Transition = { duration: DURATION.reduced, ease: "linear" };

/** Parent that staggers its motion children on first render. */
export function entranceGroup(reduced: boolean): Variants {
  return {
    hidden: {},
    show: {
      transition: reduced
        ? { delayChildren: 0 }
        : { delayChildren: stagger(STAGGER) },
    },
  };
}

/** A child of entranceGroup: 12px fade-up, or a plain fade under reduced motion. */
export function entranceItem(reduced: boolean): Variants {
  return reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: reducedFade } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: enter },
      };
}

/** The orb settling into a measured tone, once. */
export function orbSettle(reduced: boolean) {
  return reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reducedFade }
    : {
        initial: { opacity: 0.4, scale: 0.92, filter: "blur(6px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        transition: enter,
      };
}
