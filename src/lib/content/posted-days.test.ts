import { describe, expect, it } from "vitest";
import { bucketPostedByDay, type PostedVideo } from "./posted-days";
import { dayKey } from "./calendar";

const video = (over: Partial<PostedVideo>): PostedVideo => ({
  platform: "youtube",
  id: "1",
  title: "How I edit in ten minutes",
  thumbnail: null,
  viewCount: 100,
  publishedAt: new Date(2026, 9, 3, 10).toISOString(),
  url: "https://example.com/1",
  ...over,
});

const NOW = new Date(2026, 9, 10).getTime();
const DAY = dayKey(new Date(2026, 9, 3));

describe("bucketPostedByDay", () => {
  it("merges a same-day cross-post into one group with summed views", () => {
    const byDay = bucketPostedByDay(
      [
        video({}),
        video({
          platform: "tiktok",
          id: "2",
          title: "How I edit in ten minutes #editing #creator",
          viewCount: 900,
        }),
      ],
      NOW,
    );
    const groups = byDay.get(DAY)!;
    expect(groups).toHaveLength(1);
    expect(groups[0].views).toBe(1000);
    expect(groups[0].posts.map((p) => p.platform)).toEqual([
      "tiktok",
      "youtube",
    ]);
  });

  it("keeps two posts on the same platform apart even with one title", () => {
    const groups = bucketPostedByDay([video({}), video({ id: "2" })], NOW).get(
      DAY,
    )!;
    expect(groups).toHaveLength(2);
  });

  it("never merges untitled posts", () => {
    const groups = bucketPostedByDay(
      [video({ title: "" }), video({ title: "", platform: "tiktok", id: "2" })],
      NOW,
    ).get(DAY)!;
    expect(groups).toHaveLength(2);
  });

  it("drops future-dated and unparseable rows", () => {
    const byDay = bucketPostedByDay(
      [
        video({ publishedAt: new Date(2026, 9, 20).toISOString() }),
        video({ id: "2", publishedAt: "not a date" }),
      ],
      NOW,
    );
    expect(byDay.size).toBe(0);
  });
});
