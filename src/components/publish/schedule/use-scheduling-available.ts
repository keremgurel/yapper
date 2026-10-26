"use client";

import { useEffect, useState } from "react";
import { fetchSchedules } from "@/lib/publish/schedule-client";

/** Whether this server can send posts later. Null while checking; a failed
 * check counts as unavailable, so the flow falls back to posting now. */
export function useSchedulingAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetchSchedules().then(
      (result) => active && setAvailable(result.enabled),
      () => active && setAvailable(false),
    );
    return () => {
      active = false;
    };
  }, []);
  return available;
}
