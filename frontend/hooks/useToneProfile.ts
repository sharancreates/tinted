"use client";

import { useEffect, useState } from "react";
import { loadToneProfile, TONE_EVENT, type ToneProfile } from "@/lib/toneProfile";

/**
 * The last reading saved on this device. `ready` is false until the first
 * client render has read storage, so server and client markup agree.
 */
export function useToneProfile(): { profile: ToneProfile | null; ready: boolean } {
  const [state, setState] = useState<{ profile: ToneProfile | null; ready: boolean }>({
    profile: null,
    ready: false,
  });

  useEffect(() => {
    const read = () => setState({ profile: loadToneProfile(), ready: true });
    read();
    window.addEventListener(TONE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(TONE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return state;
}
