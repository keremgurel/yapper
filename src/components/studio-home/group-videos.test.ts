import { describe, expect, it } from "vitest";
import { groupVideos } from "./group-videos";
import type { RankedVideo } from "./rank-videos";
const now = Date.parse("2026-10-15T12:00:00Z");
function post(
  id: string,
  platform: RankedVideo["platform"],
  days = 4,
  views = 200,
  title = "Building apps to $10K MRR episode 14",
): RankedVideo {
  return {
    id,
    platform,
    title,
    thumbnail: null,
    viewCount: views,
    publishedAt: new Date(now - days * 86400000).toISOString(),
    privacyStatus: "public",
    url: `https://example.com/${id}`,
  };
}
describe("distinct videos", () => {
  it("groups matching captions across channels but preserves episodes and same-platform posts", () => {
    const groups = groupVideos([
      post("yt", "youtube"),
      post(
        "ig",
        "instagram",
        5,
        300,
        "Building apps to $10K MRR episode 14! #buildinpublic",
      ),
      post("tt", "tiktok", 4, 10),
      post("older", "tiktok", 6, 30, "Building apps to $10K MRR episode 13"),
      post("repeat", "youtube"),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[0].views).toBe(510);
    expect(groups[0].posts).toHaveLength(3);
  });
  it("does not guess from generic titles, undated posts, or conflicting sources", () => {
    expect(
      groupVideos([
        post("1", "youtube", 4, 100, "Untitled"),
        post("2", "instagram", 4, 100, "Untitled"),
      ]),
    ).toHaveLength(2);
    expect(
      groupVideos([
        { ...post("1", "youtube"), publishedAt: "" },
        post("2", "instagram"),
      ]),
    ).toHaveLength(2);
    expect(
      groupVideos([
        { ...post("1", "youtube"), mediaKey: "a" },
        { ...post("2", "instagram"), mediaKey: "b" },
      ]),
    ).toHaveLength(2);
  });
  it("does not bridge conflicting sources through a caption-only post", () => {
    expect(
      groupVideos([
        { ...post("a", "youtube", 4, 300), mediaKey: "one" },
        post("b", "instagram", 4, 200),
        { ...post("c", "tiktok", 4, 100), mediaKey: "two" },
      ]),
    ).toHaveLength(2);
  });
  it("uses the original source even with different captions and dates", () => {
    expect(
      groupVideos([
        { ...post("1", "youtube"), mediaKey: "source" },
        {
          ...post("2", "instagram", 100, 30, "Different caption"),
          mediaKey: "source",
        },
      ]),
    ).toHaveLength(1);
  });
  it("does not count a repeated provider ID twice", () => {
    expect(
      groupVideos([post("1", "youtube"), post("1", "youtube")])[0].views,
    ).toBe(200);
  });
});
