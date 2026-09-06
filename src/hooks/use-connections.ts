"use client";

import { useCallback, useRef, useState } from "react";
import { disconnectPlatform, fetchConnections } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** Shared saved connections. A disconnect becomes visible only after the server
 * confirms it, and a failed read remains distinguishable from no accounts. */
export function useConnections(enabled: boolean) {
  const {
    data,
    error: loadError,
    refresh: refreshResource,
    mutate,
  } = useClientResource(
    STUDIO_RESOURCE_KEYS.connections,
    enabled,
    fetchConnections,
  );
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const [disconnectError, setDisconnectError] = useState<Error | null>(null);
  const [pending, setPending] = useState<PublishPlatform[]>([]);
  const running = useRef(new Set<PublishPlatform>());
  const refresh = useCallback(async () => {
    try {
      const saved = await refreshResource(true);
      setRefreshError(null);
      return saved;
    } catch (cause) {
      setRefreshError(
        cause instanceof Error ? cause : new Error("load_failed"),
      );
      return null;
    }
  }, [refreshResource]);
  const disconnect = useCallback(
    async (platform: PublishPlatform) => {
      if (running.current.has(platform)) return false;
      running.current.add(platform);
      setPending([...running.current]);
      setDisconnectError(null);
      try {
        await disconnectPlatform(platform);
        mutate((current) => ({
          connections:
            current?.connections.filter(
              (connection) => connection.platform !== platform,
            ) ?? [],
          available: current?.available ?? [],
        }));
        void refresh();
        return true;
      } catch (cause) {
        setDisconnectError(
          cause instanceof Error ? cause : new Error("disconnect_failed"),
        );
        return false;
      } finally {
        running.current.delete(platform);
        setPending([...running.current]);
      }
    },
    [mutate, refresh],
  );
  const error = refreshError ?? (data === null ? loadError : null);
  return {
    connections: data?.connections ?? null,
    available: data?.available ?? [],
    refresh,
    disconnect,
    loading: data === null && !error,
    error,
    disconnectError,
    pending,
  };
}
