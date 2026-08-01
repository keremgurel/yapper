"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";

export type VideoSort = "recent" | "views";

/**
 * A connected platform's own videos, sortable by recency or view count. `null`
 * while loading; `connected` says whether the platform is even linked (so the
 * UI shows "connect" vs "no videos yet"). Switching platform reloads. Only the
 * fetch differs per platform, so one hook serves them all.
 */
export function usePlatformVideos(
  platform: PublishPlatform,
  enabled: boolean,
  sort: VideoSort,
) {
  const [videos, setVideos] = useState<PlatformVideo[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadedPlatform, setLoadedPlatform] = useState<PublishPlatform | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    setRefreshing(true);
    const data = await fetchPlatformVideos(platform);
    if (id !== requestId.current) return;
    setConnected(data.connected);
    setVideos(data.videos);
    setLoadedPlatform(platform);
    setRefreshing(false);
  }, [enabled, platform]);

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    void fetchPlatformVideos(platform).then((data) => {
      if (id !== requestId.current) return;
      setConnected(data.connected);
      setVideos(data.videos);
      setLoadedPlatform(platform);
      setRefreshing(false);
    });
    return () => {
      requestId.current += 1;
    };
  }, [enabled, platform]);

  // Posts are often published in Instagram/TikTok/YouTube while Poster stays
  // open. Refresh on return and periodically while visible, without clearing
  // the existing cards or shifting the layout.
  useEffect(() => {
    if (!enabled) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const timer = window.setInterval(refreshIfVisible, 60_000);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  const visibleVideos = loadedPlatform === platform ? videos : null;
  const sorted =
    visibleVideos &&
    [...visibleVideos].sort((a, b) =>
      sort === "views"
        ? b.viewCount - a.viewCount
        : b.publishedAt.localeCompare(a.publishedAt),
    );

  return {
    videos: sorted,
    connected: loadedPlatform === platform ? connected : false,
    refreshing,
    refresh,
  };
}
