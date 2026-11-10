"use client"

import { DURATION, EASE } from "@/lib/motion"
import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraModal({ onCapture, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError("Camera access is needed. Check your browser settings.")
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [facingMode])

  const capture = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Draw un-mirrored (natural feed) so backend receives correct colors
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      onCapture(file)
    }, "image/jpeg", 0.92)
  }, [onCapture])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        // Frosted card; the live feed itself sits in a dark well, which a camera
        // preview needs. Controls over the feed stay white-on-dark.
        className="glass-strong relative w-[min(92vw,460px)] overflow-hidden rounded-card p-3"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.base, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute left-6 top-6 z-20 min-h-11 cursor-pointer rounded-pill bg-black/35 px-4 text-small font-semibold text-white backdrop-blur-md transition-colors duration-(--duration-fast) hover:bg-black/50"
        >
          Close
        </button>

        {/* Flip */}
        {!error && (
          <button
            onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
            className="absolute right-6 top-6 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors duration-(--duration-fast) hover:bg-black/50"
            title="Flip camera"
            aria-label="Flip camera"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M1 4v6h6" />
              <path d="M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
        )}

        {error ? (
          <div className="flex flex-col items-center gap-4 p-12 text-center">
            <p className="text-small leading-relaxed text-text-soft">{error}</p>
            <button
              onClick={onClose}
              className="inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-accent underline underline-offset-4"
            >
              Upload a photo instead
            </button>
          </div>
        ) : (
          <>
            {/* Video + oval overlay */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-tile bg-mst-10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />

              {/* SVG oval mask */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg
                  viewBox="0 0 100 130"
                  className="w-[58%] h-[75%]"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <mask id="oval-hole">
                      <rect width="100" height="130" fill="white" />
                      <ellipse cx="50" cy="65" rx="44" ry="58" fill="black" />
                    </mask>
                  </defs>
                  <rect
                    width="100"
                    height="130"
                    fill="rgba(0,0,0,0.48)"
                    mask="url(#oval-hole)"
                  />
                  <ellipse
                    cx="50"
                    cy="65"
                    rx="44"
                    ry="58"
                    fill="none"
                    stroke="#e2603a"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                </svg>
              </div>

              <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-small text-white/85">
                Centre your face in the oval
              </p>
            </div>

            {/* Capture button */}
            <div className="flex justify-center pb-2 pt-4">
              <button
                onClick={capture}
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-white shadow-card ring-4 ring-accent-vivid/80 transition-shadow duration-(--duration-fast) hover:shadow-lift"
                aria-label="Capture photo"
              >
                <div className="h-11 w-11 rounded-full bg-accent-vivid" />
              </button>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </motion.div>
  )
}
