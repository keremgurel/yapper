import { describe, expect, it } from "vitest";
import { rankVideos } from "@/components/studio-home/rank-videos";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";
import type { PlatformVideo } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";

const video = (id: string, viewCount: number): PlatformVideo =>
  ({
    id,
    title: id,
    thumbnail: null,
    viewCount,
    publishedAt: "2026-01-01T00:00:00.000Z",
    privacyStatus: "public",
    url: `https://example.com/${id}`,
  }) as PlatformVideo;

const channel = (
  platform: PublishPlatform,
  videos: PlatformVideo[],
): ChannelResult => ({ platform, connected: true, videos });

describe("rankVideos", () => {
  it("flattens every channel, most viewed first", () => {
    const out = rankVideos([
      channel("youtube", [video("a", 10), video("b", 900)]),
      channel("tiktok", [video("c", 400)]),
    ]);
    expect(out.map((v) => v.id)).toEqual(["b", "c", "a"]);
  });

  it("tags each video with the channel it came from", () => {
    const out = rankVideos([channel("tiktok", [video("a", 1)])]);
    expect(out[0].platform).toBe("tiktok");
  });

  /** Providers occasionally omit viewCount despite the type saying otherwise.
   * A missing value must sort as zero: an undefined in the comparator makes
   * every comparison NaN and leaves the whole order unspecified, so one bad
   * row would scramble the list rather than just sinking itself. */
  it("sinks a video with a missing view count instead of scrambling the order", () => {
    const broken = { ...video("broken", 0), viewCount: undefined };
    const out = rankVideos([
      channel("youtube", [
        broken as unknown as PlatformVideo,
        video("big", 500),
        video("small", 5),
      ]),
    ]);
    expect(out.map((v) => v.id)).toEqual(["big", "small", "broken"]);
  });

  it("is empty while channels are still loading", () => {
    expect(rankVideos(null)).toEqual([]);
    expect(rankVideos([])).toEqual([]);
    expect(rankVideos([channel("youtube", [])])).toEqual([]);
  });
});
