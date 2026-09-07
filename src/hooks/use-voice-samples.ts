"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchVoiceSamples,
  removeVoiceSample,
  type VoiceSample,
} from "@/lib/voice/client";

/** The videos the brain has listened to, and taking one out of the set. */
export function useVoiceSamples(enabled: boolean) {
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSamples(await fetchVoiceSamples());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const remove = useCallback(
    async (id: string) => {
      const previous = samples;
      setSamples((current) => current.filter((sample) => sample.id !== id));
      try {
        await removeVoiceSample(id);
      } catch {
        setSamples(previous);
        throw new Error("remove_failed");
      }
    },
    [samples],
  );

  const add = useCallback((sample: VoiceSample) => {
    setSamples((current) => [
      sample,
      ...current.filter((existing) => existing.id !== sample.id),
    ]);
  }, []);

  return { samples, loading: enabled && !loaded, failed, refresh, remove, add };
}
