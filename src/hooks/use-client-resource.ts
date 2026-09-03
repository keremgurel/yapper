"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

  // The first load failing is the one case a surface must say something about:
  // with no cached rows and no error, a page would show its loading shape
  // forever. Later refresh failures keep the stale rows and stay quiet.
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!enabled) return;
    void refresh(false)
      .then(() => setError(null))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause : new Error("load_failed")),
      );
  }, [enabled, refresh]);

  const mutate = useCallback(
    (update: T | ((current: T | null) => T)) =>
      mutateClientResource(key, update),
    [key],
  );

  return { data, error, refresh, mutate };
}
