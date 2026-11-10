"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const supabase = useRef(createClient()).current;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const resetAndClose = () => {
    setEmail("");
    setSent(false);
    onClose();
  };

  const google = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
  };

  const magicLink = async () => {
    if (!email.trim()) return;
    setBusy(true);
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    setSent(true);
  };

  // Rendered into <body>: glass cards use backdrop-filter, which traps any
  // fixed-position child inside the card, so the modal would sit behind
  // the neighbouring cards instead of over the page.
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={resetAndClose}
          role="presentation"
        >
          <motion.div
            className="relative w-full max-w-md rounded-card border border-white bg-white/95 p-8 shadow-lift backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none text-text-soft transition-colors hover:border-line-strong hover:text-text"
              onClick={resetAndClose}
            >
              ×
            </button>

            <p className="font-display text-title text-text">Join Tinted.</p>
            <p className="mt-2 text-small leading-relaxed text-text-soft">
              Save shade matches, curate lip combos, and sync across devices.
            </p>

            <div className="mt-8 space-y-4">
              {sent ? (
                <div className="rounded-card border border-success/40 bg-success/10 px-4 py-5 text-center text-small text-text">
                  <p className="font-semibold text-success">Check your inbox</p>
                  <p className="mt-2 text-text-soft">
                    We sent a magic link to{" "}
                    <span className="font-medium text-text">{email}</span>
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-3 rounded-pill border border-line-strong bg-raised text-small font-semibold text-text transition-colors hover:border-accent"
                    onClick={google}
                  >
                    <GoogleGlyph /> Continue with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-label uppercase text-text-muted">
                      or email
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && magicLink()}
                    className="min-h-12 w-full rounded-pill border border-line bg-raised px-5 text-small text-text outline-none placeholder:text-text-muted focus:border-accent"
                  />

                  <button
                    type="button"
                    disabled={busy || !email.trim()}
                    className="min-h-12 w-full rounded-pill bg-accent text-small font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                    onClick={magicLink}
                  >
                    {busy ? "Sending…" : "Email me a magic link"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
