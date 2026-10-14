"use client";

import { useClientResource } from "@/hooks/use-client-resource";

export interface TimeSaved {
  edits: number;
  footageSeconds: number;
  cutCount: number;
  cutSeconds: number;
  savedSeconds: number;
  /** When the first counted 1-Click Edit ran, or null before any. */
  since: string | null;
}

async function fetchTimeSaved(): Promise<TimeSaved> {
  const res = await fetch("/api/billing/time-saved");
  if (!res.ok) throw new Error(`time_saved_${res.status}`);
  return (await res.json()) as TimeSaved;
}

/** What the creator's 1-Click Edits have saved them. Null while loading. */
export function useTimeSaved(enabled: boolean) {
  return useClientResource(
    "studio:time-saved",
    enabled,
    fetchTimeSaved,
    60_000,
  );
}
