"use client";

import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { useClientResource } from "@/hooks/use-client-resource";

export type ChannelResult = {
  platform: PublishPlatform;
  connected: boolean;
  error?: string;
  videos: PlatformVideo[];
};

/** Keep per-channel failures visible without blocking healthy channels. */
export function useChannelVideos(enabled: boolean) {
  return useClientResource(
    "studio:channels",
    enabled,
    () =>
      Promise.all(
        publishPlatforms.map(async (platform): Promise<ChannelResult> => {
          try {
            return { platform, ...(await fetchPlatformVideos(platform)) };
          } catch {
            return {
              platform,
              connected: false,
              videos: [],
              error: "videos_unavailable",
            };
          }
        }),
      ),
    60_000,
  );
}
