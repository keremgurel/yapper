"use client";

import { useRef, useState } from "react";
import {
  changeSchedule,
  scheduleErrorMessage,
} from "@/lib/publish/schedule-client";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";

export type ScheduleAction = "cancel" | "reschedule" | "retry";

/** Cancel, move or retry one scheduled post, one request at a time. */
export function useScheduleChange(
  id: string,
  onSaved: (row: ScheduleSummary) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = async (action: ScheduleAction, at?: Date) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await changeSchedule(id, action, at?.toISOString());
      onSaved(result.schedule);
      return true;
    } catch (cause) {
      setError(scheduleErrorMessage(cause));
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return { run, busy, error };
}
