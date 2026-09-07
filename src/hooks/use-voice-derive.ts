"use client";

import { useCallback, useRef, useState } from "react";
import { deriveVoiceProfile, VoiceRequestError } from "@/lib/voice/client";

/** Rebuilds the voice profile from the current samples. */
export function useVoiceDerive(onApplied: () => Promise<unknown> | void) {
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const derive = useCallback(async () => {
    if (running.current) return false;
    running.current = true;
    setDeriving(true);
    setError(null);
    try {
      await deriveVoiceProfile();
      await onApplied();
      return true;
    } catch (cause) {
      setError(
        cause instanceof VoiceRequestError ? cause.code : "derive_failed",
      );
      return false;
    } finally {
      running.current = false;
      setDeriving(false);
    }
  }, [onApplied]);

  return { derive, deriving, error };
}
