"use client";

import { useEffect, useRef } from "react";

/**
 * Keep the screen awake while the creator is on camera.
 *
 * On a phone this is the difference between a usable teleprompter and an
 * unusable one: reading a script involves no touches, so the display dims and
 * locks partway through a take. On desktop it costs nothing and stops a
 * screensaver landing mid-recording.
 *
 * The lock is re-acquired on visibilitychange because the platform releases it
 * whenever the page is hidden, and never hands it back on its own. Without
 * that, one glance at a notification silently ends the protection for the rest
 * of the session.
 *
 * Unsupported browsers are a no-op rather than an error. Safari has shipped
 * this since 16.4, but it is still absent from enough embedded webviews that
 * treating it as required would break recording for them.
 */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const lock = navigator.wakeLock;
    if (!lock) return;

    let cancelled = false;

    const acquire = async () => {
      if (
        cancelled ||
        sentinel.current ||
        document.visibilityState !== "visible"
      )
        return;
      try {
        sentinel.current = await lock.request("screen");
        // Cleared on release so a later re-acquire is not blocked by a stale
        // sentinel the platform has already invalidated.
        sentinel.current.addEventListener("release", () => {
          sentinel.current = null;
        });
      } catch {
        // A request can be refused (low battery, backgrounded). Recording is
        // still fine; the screen simply may sleep.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [active]);
}
