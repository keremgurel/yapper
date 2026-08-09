"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  loadClientResource,
  mutateClientResource,
  readClientResource,
  subscribeClientResource,
} from "@/lib/client-resource-cache";

/** Stale-while-revalidate client data with request deduplication.
 * Cached data renders on the first frame; freshness updates in the background. */
export function useClientResource<T>(
  key: string,
  enabled: boolean,
  loader: () => Promise<T>,
  staleAfter = 30_000,
) {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const subscribe = useCallback(
    (listener: () => void) => subscribeClientResource(key, listener),
    [key],
  );
  const snapshot = useCallback(() => readClientResource<T>(key), [key]);
  const data = useSyncExternalStore(subscribe, snapshot, () => null);

  const refresh = useCallback(
    (force = true) =>
      loadClientResource(key, () => loaderRef.current(), {
        force,
        staleAfter,
      }),
    [key, staleAfter],
  );

  useEffect(() => {
    if (enabled) void refresh(false).catch(() => undefined);
  }, [enabled, refresh]);

  const mutate = useCallback(
    (update: T | ((current: T | null) => T)) =>
      mutateClientResource(key, update),
    [key],
  );

  return { data, refresh, mutate };
}
