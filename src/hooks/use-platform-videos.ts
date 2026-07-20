"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchPlatformVideos(platform).then((data) => {
      if (!live) return;
      setConnected(data.connected);
      setVideos(data.videos);
    });
    return () => {
      live = false;
    };
  }, [enabled, platform]);

  const sorted =
    videos &&
    [...videos].sort((a, b) =>
      sort === "views"
        ? b.viewCount - a.viewCount
        : b.publishedAt.localeCompare(a.publishedAt),
    );

  return { videos: sorted, connected };
}
