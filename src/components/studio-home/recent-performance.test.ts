import { expect, it } from "vitest";
import { recentPerformance } from "./recent-performance";
import type { RankedVideo } from "./rank-videos";
const now = Date.parse("2026-10-15T12:00:00Z");
function post(
  id: string,
  platform: RankedVideo["platform"],
  days: number,
  views: number,
  title = "Building apps to $10K MRR episode 14",
): RankedVideo {
  return {
    id,
    platform,
    title,
    publishedAt: new Date(now - days * 86400000).toISOString(),
    viewCount: views,
    thumbnail: null,
    url: "",
    privacyStatus: "public",
  };
}
it("counts unique videos while retaining each channel's contribution", () => {
  const data = recentPerformance(
    [
      post("1", "youtube", 2, 100),
      post("2", "instagram", 2, 300),
      post("3", "youtube", 20, 600, "Another useful distinct video"),
    ],
    ["youtube", "instagram", "tiktok"],
    now,
  );
  expect(data.groups).toHaveLength(2);
  expect(data.totalViews).toBe(1000);
  expect(data.postCount).toBe(3);
  expect(data.typical).toBe(500);
  expect(data.thisWeek).toBe(1);
  expect(data.channels.find((c) => c.platform === "tiktok")).toMatchObject({
    views: 0,
    posts: 0,
  });
  expect(data.channels.find((c) => c.platform === "youtube")).toMatchObject({
    views: 700,
    posts: 2,
    typical: 350,
  });
});
it("filters old, future and undated posts before matching stored sources", () => {
  const data = recentPerformance(
    [
      { ...post("1", "youtube", 31, 9000), mediaKey: "same" },
      { ...post("2", "instagram", 1, 100), mediaKey: "same" },
      post("future", "youtube", -1, 800),
      { ...post("undated", "youtube", 1, 100), publishedAt: "" },
    ],
    [],
    now,
  );
  expect(data.groups).toHaveLength(1);
  expect(data.totalViews).toBe(100);
  expect(data.postCount).toBe(1);
});
it("includes the 30-day boundary and reports honest zero values", () => {
  expect(
    recentPerformance([post("1", "youtube", 30, 200)], [], now).totalViews,
  ).toBe(200);
  expect(recentPerformance([], [], now)).toMatchObject({
    totalViews: 0,
    postCount: 0,
    typical: 0,
    thisWeek: 0,
    groups: [],
  });
});
