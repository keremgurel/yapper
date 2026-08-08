import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";

export type RankedVideo = PlatformVideo & { platform: PublishPlatform };

/** Every loaded video across all channels, most viewed first. */
export function rankVideos(channels: ChannelResult[] | null): RankedVideo[] {
  return (channels ?? [])
    .flatMap(({ platform, videos }) =>
      videos.map((video) => ({ ...video, platform })),
    )
    .sort(
      // Providers occasionally omit viewCount despite the type; treat it as
      // zero so one bad row cannot scramble the sort (a NaN comparator makes
      // the whole order unspecified).
      (a, b) => (b.viewCount || 0) - (a.viewCount || 0),
    );
}
