"use client";

import { useMemo, useState } from "react";
import { useChannelVideos } from "@/components/studio-home/use-channel-videos";
import { bucketPostedByDay, type PostedGroup } from "@/lib/content/posted-days";

const EMPTY = new Map<string, PostedGroup[]>();

/**
 * What already went out on the connected channels, by local day.
 *
 * Reads the same cached channel lists Home does (one key, one request per
 * platform per minute at most, shared across both screens), so opening the
 * calendar after Home costs no provider calls. These are the platforms' own
 * APIs, not scraping. A channel that fails to load just contributes nothing.
 */
export function usePostedDays(enabled: boolean): Map<string, PostedGroup[]> {
  const { data } = useChannelVideos(enabled);
  const [now] = useState(() => Date.now());
  return useMemo(
    () =>
      data
        ? bucketPostedByDay(
            data.flatMap(({ platform, videos }) =>
              videos.map((video) => ({ ...video, platform })),
            ),
            now,
          )
        : EMPTY,
    [data, now],
  );
}
