"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearYouTubeBrowserData,
  YOUTUBE_DISCONNECTED_EVENT,
} from "@/lib/inspiration/store";
import { disconnectPlatform, fetchConnections } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  STUDIO_RESOURCE_KEYS,
  mutateClientResource,
} from "@/lib/client-resource-cache";
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
  useEffect(() => {
    if (!enabled) return;
    const clearChannel = () =>
      mutateClientResource(STUDIO_RESOURCE_KEYS.channel("youtube"), {
        connected: false,
        videos: [],
      });
    const storage = (event: StorageEvent) => {
      if (event.key === YOUTUBE_DISCONNECTED_EVENT) clearChannel();
    };
    const check = () => {
      void refresh().then((saved) => {
        if (
          saved &&
          !saved.connections.some(
            (c) => c.platform === "youtube" && c.status === "active",
          )
        )
          clearYouTubeBrowserData();
      });
    };
    window.addEventListener(YOUTUBE_DISCONNECTED_EVENT, clearChannel);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 60 * 60_000);
    return () => {
      window.removeEventListener(YOUTUBE_DISCONNECTED_EVENT, clearChannel);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);
  const disconnect = useCallback(
    async (platform: PublishPlatform) => {
      if (running.current.has(platform)) return false;
      running.current.add(platform);
      setPending([...running.current]);
      setDisconnectError(null);
      try {
        await disconnectPlatform(platform);
        if (platform === "youtube") clearYouTubeBrowserData();
        mutateClientResource(STUDIO_RESOURCE_KEYS.channel(platform), {
          connected: false,
          videos: [],
        });
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
