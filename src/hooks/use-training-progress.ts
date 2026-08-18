"use client";

import { useClientResource } from "@/hooks/use-client-resource";
import type { TrainingProgressResponse } from "@/lib/progress/types";

const RESOURCE_KEY = "training:progress";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

async function fetchTrainingProgress(): Promise<TrainingProgressResponse | null> {
  try {
    const tz = encodeURIComponent(browserTimeZone());
    const res = await fetch(`/api/training/progress?tz=${tz}`);
    return res.ok ? ((await res.json()) as TrainingProgressResponse) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user's training progress payload, stale-while-revalidate like
 * `useBillingStatus`: the last fetched dashboard renders instantly on
 * revisits and corrects itself in the background. The browser's timezone
 * rides along so the day streak is counted in the viewer's day.
 */
export function useTrainingProgress() {
  const { data, refresh } = useClientResource(
    RESOURCE_KEY,
    true,
    fetchTrainingProgress,
  );

  return { progress: data ?? null, loading: data === null, refresh };
}
