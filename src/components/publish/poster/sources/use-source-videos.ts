"use client";

import { useState } from "react";
import { usePlatformVideos, type VideoSort } from "@/hooks/use-platform-videos";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PostableVideo } from "@/lib/publish/postable-videos";
import { fromPlatform, fromPostable, type PosterVideo } from "../poster-video";

export type PosterSource = "yapper" | PublishPlatform;

/**
 * The videos behind the selected source tab, in one shape. Yapper's finished
 * takes come from the library the workspace already holds; a channel's posts
 * come from that platform's cached list. Only the selected platform is
 * fetched, so switching tabs costs one request the first time and nothing
 * after.
 */
export function useSourceVideos(
  source: PosterSource,
  library: { videos: PostableVideo[]; loading: boolean },
  signedIn: boolean,
) {
  const [sort, setSort] = useState<VideoSort>("recent");
  const platform: PublishPlatform = source === "yapper" ? "youtube" : source;
  const channel = usePlatformVideos(
    platform,
    signedIn && source !== "yapper",
    sort,
  );

  if (source === "yapper") {
    return {
      videos: library.videos.map(fromPostable) as PosterVideo[],
      loading: library.loading,
      connected: true,
      sort,
      setSort,
    };
  }
  return {
    videos: (channel.videos ?? []).map((video) =>
      fromPlatform(platform, video),
    ),
    loading: channel.videos === null,
    connected: channel.connected,
    sort,
    setSort,
  };
}
