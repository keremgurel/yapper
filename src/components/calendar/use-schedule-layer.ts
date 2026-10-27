"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bucketByDay, rescheduleIso } from "@/lib/content/calendar";
import {
  changeSchedule,
  scheduleErrorMessage,
} from "@/lib/publish/schedule-client";
import type { ScheduleLayer } from "./calendar-day-cell";
import { SCHEDULE_STATUS } from "./schedule-status";
import { usePublishingSchedules } from "./use-publishing-schedules";

/**
 * Scheduled posts as a calendar layer: bucketed by local day, and movable by
 * drag. A move keeps the post's time of day, shows at once, and snaps back
 * with the reason if the server refuses it.
 */
export function useScheduleLayer(signedIn: boolean) {
  const { data, error, replace } = usePublishingSchedules(signedIn);
  const [moveError, setMoveError] = useState<string | null>(null);
  const schedules = useMemo(() => data?.schedules ?? [], [data]);

  useEffect(() => {
    if (!moveError) return;
    const timer = window.setTimeout(() => setMoveError(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [moveError]);

  const byDay = useMemo(
    () =>
      bucketByDay(
        schedules.filter((row) => SCHEDULE_STATUS[row.status].onGrid),
        (row) => row.scheduledFor,
      ),
    [schedules],
  );

  const onDrop = useCallback(
    async (id: string, day: Date) => {
      const row = schedules.find((candidate) => candidate.id === id);
      if (!row || row.status !== "scheduled") return;
      const scheduledFor = rescheduleIso(row.scheduledFor, day);
      if (scheduledFor === row.scheduledFor) return;
      if (new Date(scheduledFor).getTime() < Date.now() + 2 * 60_000) {
        setMoveError(
          "That time has already passed. Drop it on a later day, or open it to pick a time.",
        );
        return;
      }
      setMoveError(null);
      replace({ ...row, scheduledFor });
      try {
        replace(
          (await changeSchedule(id, "reschedule", scheduledFor)).schedule,
        );
      } catch (cause) {
        replace(row);
        setMoveError(scheduleErrorMessage(cause));
      }
    },
    [schedules, replace],
  );

  const layer: ScheduleLayer = useMemo(
    () => ({
      byDay,
      onDrop: (id, day) => void onDrop(id, day),
      onSaved: replace,
    }),
    [byDay, onDrop, replace],
  );

  return {
    layer,
    schedules,
    enabled: data?.enabled ?? false,
    moveError,
    loadFailed: error,
  };
}
