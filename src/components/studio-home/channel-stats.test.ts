import { describe, expect, it } from "vitest";
import {
  channelStats,
  typicalViews,
  versusUsual,
  weeklyPosts,
} from "@/components/studio-home/channel-stats";
import type { RankedVideo } from "@/components/studio-home/rank-videos";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const DAY = 86_400_000;

function post(
  daysAgo: number,
  viewCount: number,
  platform: RankedVideo["platform"] = "youtube",
): RankedVideo {
  return {
    id: `${platform}-${daysAgo}-${viewCount}`,
    title: "",
    thumbnail: null,
    viewCount,
    publishedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    privacyStatus: "public",
    url: "",
    platform,
  };
}

describe("typicalViews", () => {
  it("is the median, so one viral post does not move it", () => {
    expect(typicalViews([post(1, 100), post(2, 200), post(3, 90_000)])).toBe(
      200,
    );
    expect(typicalViews([post(1, 100), post(2, 300)])).toBe(200);
    expect(typicalViews([])).toBe(0);
  });
});

describe("versusUsual", () => {
  it("compares against the typical post", () => {
    expect(versusUsual(600, 200)).toBe(3);
    expect(versusUsual(600, 0)).toBeNull();
  });
});

describe("weeklyPosts", () => {
  it("counts posts per rolling week, this week last", () => {
    const weeks = weeklyPosts([post(1, 1), post(2, 1), post(9, 1)], NOW, 3);
    expect(weeks).toEqual([0, 1, 2]);
  });
});

describe("channelStats", () => {
  it("adds up views, compares the last 30 days, and splits by platform", () => {
    const stats = channelStats(
      [
        post(5, 1_000, "tiktok"),
        post(20, 500),
        post(40, 750),
        post(45, 750, "instagram"),
        post(200, 10_000),
      ],
      NOW,
    );
    expect(stats.totalViews).toBe(13_000);
    expect(stats.postCount).toBe(5);
    expect(stats.recentViews).toBe(1_500);
    expect(stats.recentChange).toBeCloseTo(0);
    expect(stats.postsThisWeek).toBe(1);
    expect(stats.platforms.map((entry) => entry.platform)).toEqual([
      "youtube",
      "tiktok",
      "instagram",
    ]);
  });

  it("has no change to report without earlier posts", () => {
    expect(channelStats([post(3, 100)], NOW).recentChange).toBeNull();
  });
});
