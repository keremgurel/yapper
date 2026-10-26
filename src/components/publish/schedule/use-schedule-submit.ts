"use client";

import { useRef, useState } from "react";
import {
  scheduleErrorMessage,
  schedulePosts,
  type ScheduleRequest,
} from "@/lib/publish/schedule-client";
import { MIN_LEAD_MS } from "./quick-times";

type Targets = ScheduleRequest["targets"];

/** Errors the server returns only after checking for a replay, so only when
 * nothing is saved under the request key. After one of these the creator may
 * change the selection, so the next try starts over. Sign-in, the scheduler
 * switch and the browser's own "too soon" check come before that check and
 * say nothing about an earlier request, so they keep the key. */
const NOT_SAVED = new Set([
  "invalid_body",
  "destination_not_connected",
  "destination_account_changed",
  "thumbnail_unavailable",
  "media_unavailable",
  "media_not_found",
  "content_item_unavailable",
  "duplicate_destination",
  "too_many_scheduled",
]);

/**
 * Saves one reviewed selection for later, once.
 *
 * When the outcome is unknown (a lost response, a server error), the request
 * key and the exact targets are kept, so trying again replays the saved
 * schedule instead of creating a second one. Rebuilding the targets would
 * re-upload the cover under a new key and the server would see a different
 * request. A rejection that saved nothing clears both, so edits made after it
 * are what gets sent.
 */
export function useScheduleSubmit(onBusy?: (busy: boolean) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<Date | null>(null);
  const pending = useRef<{ key: string; targets: Targets } | null>(null);
  const running = useRef(false);

  const submit = async (at: Date, targets: () => Promise<Targets | null>) => {
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
      if (!pending.current) {
        const resolved = await targets();
        if (!resolved?.length) return;
        pending.current = { key: crypto.randomUUID(), targets: resolved };
      }
      await schedulePosts({
        requestKey: pending.current.key,
        scheduledFor: at.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        targets: pending.current.targets,
      });
      setSavedFor(at);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (NOT_SAVED.has(code) || code.startsWith("tiktok_"))
        pending.current = null;
      const unknown =
        scheduleErrorMessage(cause) === scheduleErrorMessage(new Error(""));
      setError(
        code === "schedule_too_soon"
          ? "Pick a time at least a few minutes from now."
          : unknown && pending.current
            ? "We couldn’t confirm this was saved. Press Schedule again to check: it resends the same post, so nothing is scheduled twice. Changes made since aren’t included."
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
