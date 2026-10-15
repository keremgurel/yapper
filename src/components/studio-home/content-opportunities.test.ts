import { describe, expect, it } from "vitest";
import { contentOpportunities, groupVideos } from "./content-opportunities";
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
const baseline = Array.from({ length: 5 }, (_, i) =>
  post(`base${i}`, "youtube", 10 + i, 100, `Different useful idea number ${i}`),
);
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
describe("daily opportunities", () => {
  it("uses same-channel mature baselines and shows a group once", () => {
    const videos = [
      ...baseline,
      post("winner", "youtube", 4, 1000),
      post("other", "instagram", 5, 200, "A different useful recent video"),
    ];
    const suggestions = contentOpportunities(
      groupVideos(videos),
      videos,
      ["youtube", "instagram"],
      now,
    );
    expect(suggestions[0].kind).toBe("follow-up");
    expect(suggestions[0].comparison?.times).toBe(10);
    expect(new Set(suggestions.map((s) => s.group.id)).size).toBe(
      suggestions.length,
    );
  });
  it("avoids premature judgments, missing baselines and disconnected targets", () => {
    const videos = [post("new", "youtube", 0.2, 10000)];
    expect(
      contentOpportunities(groupVideos(videos), videos, ["youtube"], now),
    ).toEqual([]);
  });
  it("rotates candidates deterministically and expires old recommendations", () => {
    const videos = [
      post("a", "youtube"),
      post("b", "youtube", 5, 200, "Another useful recent video"),
      post("ancient", "youtube", 200),
    ];
    const groups = groupVideos(videos);
    const first = contentOpportunities(
      groups,
      videos,
      ["youtube", "instagram"],
      now,
    );
    expect(
      contentOpportunities(groups, videos, ["youtube", "instagram"], now),
    ).toEqual(first);
    expect(
      contentOpportunities(groups, videos, ["youtube", "instagram"], now, 1)[0]
        .group.id,
    ).not.toBe(first[0].group.id);
    expect(first[0].group.primary.id).not.toBe("ancient");
  });
});
