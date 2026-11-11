"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { FIELD } from "@/components/ui/field";
import { ApiError, lookupBarcode } from "@/lib/api";
import { productQuery, type Product } from "@/lib/shades";
import { SearchMethod } from "./SearchMethod";

type Status = "idle" | "starting" | "scanning" | "looking" | "none" | "error";

/**
 * Scan the barcode on the box with the camera, or type its digits. The number
 * is looked up in Open Beauty Facts for a name, which then runs through the
 * normal catalogue search. The scanner library (~350 KB) loads only when the
 * camera is started.
 */
export function BarcodeMethod({ onPick }: { onPick: (p: Product) => void }) {
  const regionId = `scan-${useId().replace(/:/g, "")}`;
  const scanner = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");

  const stop = useCallback(async () => {
    const s = scanner.current;
    scanner.current = null;
    if (s?.isScanning) {
      try {
        await s.stop();
      } catch {
        // Already stopped.
      }
    }
    s?.clear();
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const resolve = async (code: string) => {
    setStatus("looking");
    setQuery("");
    try {
      const { product } = await lookupBarcode(code);
      if (!product) {
        setMessage(`Barcode ${code} isn't in the open product database yet. Try a photo of the box, or search by name.`);
        setStatus("none");
        return;
      }
      setQuery(productQuery(product.brand, product.product_name));
      setStatus("idle");
    } catch (e) {
      setMessage(e instanceof ApiError ? e.reasons[0] : "Couldn't look that up. Try again.");
      setStatus("error");
    }
  };

  const start = async () => {
    setStatus("starting");
    setQuery("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      const s = new Html5Qrcode(regionId, {
        formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => ({ width: Math.round(w * 0.8), height: Math.round(Math.min(h, w) * 0.4) }) },
        (text) => {
          void stop();
          void resolve(text.trim());
        },
        undefined,
      );
      setStatus("scanning");
    } catch {
      await stop();
      setMessage("The camera didn't start. Allow camera access, or type the numbers under the barcode.");
      setStatus("error");
    }
  };

  const scanning = status === "scanning" || status === "starting";

  return (
    <div className="grid gap-4">
      <div className={scanning ? "overflow-hidden rounded-tile bg-text" : "hidden"}>
        <div id={regionId} className="aspect-[4/3] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (scanning ? void stop().then(() => setStatus("idle")) : void start())}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-text px-5 text-small font-semibold text-bg transition-[background-color,transform] duration-(--duration-fast) ease-(--ease-out-soft) hover:bg-text-soft motion-safe:hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M8 9v6M11 9v6M14 9v6M17 9v6" />
          </svg>
          {scanning ? "Stop camera" : "Scan with camera"}
        </button>
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = typed.replace(/\D/g, "");
            if (code.length >= 8) void resolve(code);
          }}
        >
          <label htmlFor={`${regionId}-code`} className="sr-only">
            Barcode number
          </label>
          <input
            id={`${regionId}-code`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Or type the digits"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={`${FIELD} min-w-0`}
          />
          <button type="submit" className="shrink-0 rounded-pill px-4 text-small font-semibold text-accent hover:bg-peach/60">
            Look up
          </button>
        </form>
      </div>

      <p className="text-small text-text-muted" aria-live="polite">
        {status === "starting" && "Starting the camera…"}
        {status === "scanning" && "Hold the barcode inside the box."}
        {status === "looking" && "Looking up that barcode…"}
      </p>
      {(status === "none" || status === "error") && <p className="rounded-tile bg-blush px-4 py-3 text-small text-blush-ink">{message}</p>}
      {query && (
        <div>
          <p className="mb-2 text-small text-text-soft">
            That&apos;s <span className="font-semibold text-text">{query}</span>. Pick the match:
          </p>
          <SearchMethod onPick={onPick} initialQuery={query} />
        </div>
      )}
    </div>
  );
}
