"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disconnectPlatform,
  fetchConnections,
  type ConnectionSummary,
} from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";

/**
 * The user's platform connections: which are connected, which can be connected,
 * and disconnecting. One concern — the connect flow itself is a full-page
 * redirect (see `connectUrl`), so it isn't handled here.
 */
export function useConnections(enabled: boolean) {
  const [connections, setConnections] = useState<ConnectionSummary[] | null>(
    null,
  );
  const [available, setAvailable] = useState<PublishPlatform[]>([]);
  // `available` starts empty before the first fetch resolves, so a caller
  // that reads "not available yet" as "coming soon" would flash every
  // platform as unconfigured on every load. Exposed so the panel can render
  // a neutral loading state instead of that false negative.
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchConnections();
      setConnections(data.connections);
      setAvailable(data.available);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const disconnect = useCallback(
    async (platform: PublishPlatform) => {
      // Optimistic: drop it, then reconcile.
      setConnections(
        (prev) => prev?.filter((c) => c.platform !== platform) ?? prev,
      );
      try {
        await disconnectPlatform(platform);
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  return { connections, available, refresh, disconnect, loading };
}
