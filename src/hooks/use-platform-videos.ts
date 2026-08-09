"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";
import type { PublishPlatform } from "@/lib/db/schema";

export type VideoSort = "recent" | "views";

/**
 * A connected platform's own videos, sortable by recency or view count.
 *
 * Served from the shared resource cache, keyed per platform. Poster and
 * Connections both mount this, so fetching per mount meant every visit to
 * either tab started empty even though the answer had just been fetched.
 * Keying by platform is also what makes flipping between platforms instant
 * once each has been seen: the entries do not evict one another.
 *
 * `null` videos means loading; `connected` says whether the platform is linked
 * at all, so the UI can show "connect" rather than "no videos yet".
 */
export function usePlatformVideos(
  platform: PublishPlatform,
  enabled: boolean,
  sort: VideoSort,
) {
  const [refreshing, setRefreshing] = useState(false);

  const { data, refresh: refreshResource } = useClientResource(
    STUDIO_RESOURCE_KEYS.channel(platform),
    enabled,
    () => fetchPlatformVideos(platform),
    60_000,
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    try {
      await refreshResource(true);
    } finally {
      setRefreshing(false);
    }
  }, [enabled, refreshResource]);

  // Posts are often published in Instagram, TikTok or YouTube while Poster
  // stays open. Refresh on return and periodically while visible, without
  // clearing the existing cards or shifting the layout.
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

  const sorted: PlatformVideo[] | null = data
    ? [...data.videos].sort((a, b) =>
        sort === "views"
          ? b.viewCount - a.viewCount
          : b.publishedAt.localeCompare(a.publishedAt),
      )
    : null;

  return {
    videos: sorted,
    connected: data?.connected ?? false,
    refreshing,
    refresh,
  };
}
