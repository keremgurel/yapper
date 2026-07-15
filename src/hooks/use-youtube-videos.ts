"use client";

import { useEffect, useState } from "react";
import { fetchYouTubeVideos, type PlatformVideo } from "@/lib/publish/client";

export type VideoSort = "recent" | "views";

/**
 * The connected YouTube channel's own uploads, sortable by recency or view
 * count. `null` while loading; `connected` says whether YouTube is even linked
 * (so the UI shows "connect" vs "no videos yet").
 */
export function useYouTubeVideos(enabled: boolean, sort: VideoSort) {
  const [videos, setVideos] = useState<PlatformVideo[] | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchYouTubeVideos().then((data) => {
      if (!live) return;
      setConnected(data.connected);
      setVideos(data.videos);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  const sorted =
    videos &&
    [...videos].sort((a, b) =>
      sort === "views"
        ? b.viewCount - a.viewCount
        : b.publishedAt.localeCompare(a.publishedAt),
    );

  return { videos: sorted, connected };
}
