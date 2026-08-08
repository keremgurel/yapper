"use client";

import { useEffect, useState } from "react";
import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

export type ChannelResult = {
  platform: PublishPlatform;
  connected: boolean;
  videos: PlatformVideo[];
};

/** Loads every platform's published videos once. `null` means still loading;
 * `fetchPlatformVideos` never rejects, so the value always settles. */
export function useChannelVideos(enabled: boolean): ChannelResult[] | null {
  const [channels, setChannels] = useState<ChannelResult[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all(
      publishPlatforms.map(async (platform) => ({
        platform,
        ...(await fetchPlatformVideos(platform)),
      })),
    ).then((results) => {
      if (!cancelled) setChannels(results);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return channels;
}
