"use client";

import { useRef, useState } from "react";
import {
  scheduleErrorMessage,
  schedulePosts,
  type ScheduleRequest,
} from "@/lib/publish/schedule-client";
import { MIN_LEAD_MS } from "./quick-times";

/**
 * Saves one reviewed selection for later, once. The request key is kept
 * across retries so a lost response replays the saved schedule instead of
 * creating a second one.
 */
export function useScheduleSubmit(onBusy?: (busy: boolean) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<Date | null>(null);
  const requestKey = useRef<string | null>(null);
  const running = useRef(false);

  const submit = async (
    at: Date,
    targets: () => Promise<ScheduleRequest["targets"] | null>,
  ) => {
    if (running.current || savedFor) return;
    running.current = true;
    onBusy?.(true);
    setSaving(true);
    setError(null);
    try {
      if (
        !Number.isFinite(at.getTime()) ||
        at.getTime() < Date.now() + MIN_LEAD_MS
      )
        throw new Error("schedule_too_soon");
      const resolved = await targets();
      if (!resolved?.length) return;
      requestKey.current ??= crypto.randomUUID();
      await schedulePosts({
        requestKey: requestKey.current,
        scheduledFor: at.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        targets: resolved,
      });
      setSavedFor(at);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "schedule_too_soon"
          ? "Pick a time at least a few minutes from now."
          : scheduleErrorMessage(cause),
      );
    } finally {
      running.current = false;
      setSaving(false);
      onBusy?.(false);
    }
  };

  return { submit, saving, error, savedFor };
}
