"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCHEDULES_CHANGED } from "@/lib/chirpy/studio/effects-client";
import { fetchSchedules } from "@/lib/publish/schedule-client";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";

type Data = Awaited<ReturnType<typeof fetchSchedules>>;

/**
 * The creator's publishing schedules, refreshed every 30 seconds while the tab
 * is visible so a post visibly moves from Scheduled to Sending to posted.
 * `replace` swaps in one saved row; it also invalidates any refresh already in
 * flight, so an older list cannot overwrite the change.
 */
export function usePublishingSchedules(enabled: boolean) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const revision = useRef(0);

  const refresh = useCallback(() => {
    const version = ++revision.current;
    return fetchSchedules().then(
      (result) => {
        if (version !== revision.current) return;
        setData(result);
        setError(false);
      },
      () => {
        if (version === revision.current) setError(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const counter = revision;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    // Chirpy moved or canceled a post.
    const changed = () => void refresh();
    window.addEventListener(SCHEDULES_CHANGED, changed);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SCHEDULES_CHANGED, changed);
      counter.current++;
    };
  }, [enabled, refresh]);

  const replace = useCallback((row: ScheduleSummary) => {
    revision.current++;
    setData((current) =>
      current
        ? {
            ...current,
            schedules: current.schedules.map((item) =>
              item.id === row.id ? row : item,
            ),
          }
        : current,
    );
  }, []);

  return { data, error, refresh, replace };
}
