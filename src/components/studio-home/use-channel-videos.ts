"use client";

import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { useClientResource } from "@/hooks/use-client-resource";

export type ChannelResult = {
  platform: PublishPlatform;
  connected: boolean;
  videos: PlatformVideo[];
};

/** Loads every platform's published videos once. `null` means still loading;
 * `fetchPlatformVideos` never rejects, so the value always settles. */
export function useChannelVideos(enabled: boolean): ChannelResult[] | null {
  return useClientResource(
    "studio:channels",
    enabled,
    () =>
      Promise.all(
        publishPlatforms.map(async (platform) => ({
          platform,
          ...(await fetchPlatformVideos(platform)),
        })),
      ),
    60_000,
  ).data;
}
