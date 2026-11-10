"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Spline scene for the hero, loaded last.
 *
 * Nothing Spline-related ships in the page bundle: the runtime (~1 MB) is a
 * separate chunk fetched only once the hero is on screen and the browser is
 * idle. Until then, and whenever the scene is missing or fails, the gradient
 * behind it is the art. Data-saver connections skip it entirely.
 *
 * The scene is set with NEXT_PUBLIC_SPLINE_SCENE_URL (a .splinecode export).
 */
const Spline = dynamic(() => import("@splinetool/react-spline"), { ssr: false });

const SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL;

type NetworkInfo = { saveData?: boolean };

export function HeroSpline({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [wanted, setWanted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!SCENE || !el) return;
    const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (connection?.saveData) return;

    let idle: number | ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = () => setWanted(true);
        idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600);
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (idle !== undefined) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle as number);
        else clearTimeout(idle);
      }
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={cn("absolute inset-0", className)}>
      {wanted && SCENE && (
        <Spline
          scene={SCENE}
          onLoad={() => setReady(true)}
          className={cn(
            "h-full w-full transition-opacity duration-(--duration-base) ease-(--ease-out-soft)",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
