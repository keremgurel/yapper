"use client";

import { useEffect, useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";

/** One connected channel's published videos, newest first. */
export function useChannelVideos(platform: PublishPlatform | null) {
  const [videos, setVideos] = useState<PlatformVideo[]>([]);
  const [loadedFor, setLoadedFor] = useState<PublishPlatform | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!platform) return;
    let active = true;
    fetchPlatformVideos(platform)
      .then((result) => {
        if (!active) return;
        setVideos(result.connected ? result.videos : []);
        setError(result.connected ? null : "not_connected");
      })
      .catch(() => {
        if (active) setError("list_failed");
      })
      .finally(() => {
        if (active) setLoadedFor(platform);
      });
    return () => {
      active = false;
    };
  }, [platform]);

  return {
    videos: loadedFor === platform ? videos : [],
    loading: platform !== null && loadedFor !== platform,
    error: loadedFor === platform ? error : null,
  };
}
