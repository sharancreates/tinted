"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import UploadScreen    from "@/components/UploadScreen"
import AnalyzingScreen from "@/components/AnalyzingScreen"
import ResultsScreen   from "@/components/ResultsScreen"
import LiveAnalyzer    from "@/components/LiveAnalyzer"
import type { AnalyseMode } from "@/components/UploadScreen"
import type { AnalyzeResult } from "@/lib/api"
import { DURATION, EASE } from "@/lib/motion"

// Whole-screen swaps: fade in on the system curve, fade out faster.
const SCREEN = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DURATION.reduced, ease: "easeIn" as const } },
}

// ── State machine ─────────────────────────────────────────────────────────────

type AppState = "upload" | "analyzing" | "live-analyzing" | "results"

export default function Home() {
  const [appState,      setAppState]      = useState<AppState>("upload")
  const [results,       setResults]       = useState<AnalyzeResult | null>(null)
  const [qualityErrors, setQualityErrors] = useState<string[] | null>(null)
  const [liveFile,      setLiveFile]      = useState<File | null>(null)
  const [liveBudget,    setLiveBudget]    = useState<string>("all")

  // Each stage swaps the whole screen out. Without moving focus, a screen
  // reader user is left on a control that no longer exists and gets no signal
  // that analysis finished — the most important moment in the flow.
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // A new screen starts at its top, not wherever the last one was scrolled to.
    window.scrollTo({ top: 0 })
    stageRef.current?.focus({ preventScroll: true })
  }, [appState])

  const handleUpload = useCallback(async (file: File, budget: string, mode: AnalyseMode = "normal") => {
    if (mode === "stream") {
      setLiveFile(file)
      setLiveBudget(budget)
      setQualityErrors(null)
      setAppState("live-analyzing")
      return
    }
    setLiveBudget(budget)
    setAppState("analyzing")
    setQualityErrors(null)

    const fd = new FormData()
    fd.append("file", file)
    fd.append("budget", budget)
    // The measurement comes back in about a second; ResultsScreen fetches the
    // product picks separately so nobody waits on Claude to see their tone.
    fd.append("recommendations", "false")

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res    = await fetch(`${apiUrl}/analyze`, { method: "POST", body: fd })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          // Normalize both formats:
          //   quality-gate 422  → ["Face is tilted…"]          (strings)
          //   FastAPI field 422 → [{type,loc,msg,input}]        (objects)
          const msgs = data.detail.map((item: unknown) =>
            typeof item === "string"
              ? item
              : typeof (item as Record<string, unknown>)?.msg === "string"
                ? (item as Record<string, unknown>).msg as string
                : `Analysis failed (${res.status}). Please try again.`
          )
          setQualityErrors(msgs)
        } else {
          const msg =
            typeof data.detail === "string"
              ? data.detail
              : `Analysis failed (${res.status}). Please try again.`
          setQualityErrors([msg])
        }
        return
      }

      const mapped: AnalyzeResult = {
        pixel_count:    data.pixel_count,
        monk_scale:     data.monk_scale,
        undertone:      data.undertone,
        avg_hex:        data.avg_hex,
        matched_shades: (data.matched_shades ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s: any) => ({
            shade_name:     s.shade_name,
            hex:            s.hex,
            description:    s.description,
            recommendation: s.recommendation ?? "",
            match_score:    typeof s.match_score === "number" ? s.match_score : undefined,
          }),
        ),
        recommendations: data.recommendations ?? {},
      }
      setResults(mapped)
      setAppState("results")
    } catch {
      setQualityErrors([
        "We couldn't reach the server. Check your connection and try again; it can take up to a minute to wake up.",
      ])
    }
  }, [])

  const handleReset = useCallback(() => {
    setAppState("upload")
    setResults(null)
    setQualityErrors(null)
    setLiveFile(null)
  }, [])

  return (
    // tabIndex -1 so it can take programmatic focus without entering the tab
    // order; the outline is suppressed because the heading inside carries the
    // visible focus, not this wrapper.
    <div ref={stageRef} tabIndex={-1} className="outline-none">
    <AnimatePresence mode="wait">
      {appState === "upload" && (
        <motion.div
          key="upload"
          {...SCREEN}
        >
          <UploadScreen onUpload={handleUpload} />
        </motion.div>
      )}

      {appState === "analyzing" && (
        <motion.div
          key="analyzing"
          {...SCREEN}
        >
          <AnalyzingScreen qualityErrors={qualityErrors} onReset={handleReset} />
        </motion.div>
      )}

      {appState === "live-analyzing" && liveFile && (
        <motion.div
          key="live-analyzing"
          {...SCREEN}
        >
          <LiveAnalyzer
            file={liveFile}
            budget={liveBudget}
            onComplete={(r) => { setResults(r); setAppState("results") }}
            onReset={handleReset}
          />
        </motion.div>
      )}

      {appState === "results" && results && (
        <motion.div
          key="results"
          {...SCREEN}
        >
          <ResultsScreen results={results} budget={liveBudget} onReset={handleReset} />
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}
