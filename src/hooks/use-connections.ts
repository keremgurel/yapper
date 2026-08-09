"use client";

import { useCallback } from "react";
import { disconnectPlatform, fetchConnections } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/**
 * The user's platform connections: which are connected, which can be connected,
 * and disconnecting. One concern — the connect flow itself is a full-page
 * redirect (see `connectUrl`), so it isn't handled here.
 */
export function useConnections(enabled: boolean) {
  const {
    data,
    refresh: refreshResource,
    mutate,
  } = useClientResource(
    STUDIO_RESOURCE_KEYS.connections,
    enabled,
    fetchConnections,
  );
  // `available` starts empty before the first fetch resolves, so a caller
  // that reads "not available yet" as "coming soon" would flash every
  // platform as unconfigured on every load. Exposed so the panel can render
  // a neutral loading state instead of that false negative.
  const refresh = useCallback(async () => {
    try {
      return await refreshResource(true);
    } catch {
      return data ?? { connections: [], available: [] };
    }
  }, [refreshResource, data]);

  const disconnect = useCallback(
    async (platform: PublishPlatform) => {
      // Optimistic: drop it, then reconcile.
      mutate((prev) => ({
        connections:
          prev?.connections.filter((c) => c.platform !== platform) ?? [],
        available: prev?.available ?? [],
      }));
      try {
        await disconnectPlatform(platform);
      } finally {
        void refresh();
      }
    },
    [refresh, mutate],
  );

  return {
    connections: data?.connections ?? null,
    available: data?.available ?? [],
    refresh,
    disconnect,
    loading: data === null,
  };
}
