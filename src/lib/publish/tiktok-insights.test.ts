import { describe, expect, it } from "vitest";
import { mapTikTokInsights } from "@/lib/publish/tiktok-insights";

describe("mapTikTokInsights", () => {
  it("reads a fully scoped response", () => {
    const insights = mapTikTokInsights({
      data: {
        user: {
          open_id: "abc",
          display_name: "Kerem",
          username: "celpip_practice",
          avatar_url: "https://cdn/x.jpg",
          bio_description: "CELPIP tips",
          is_verified: false,
          profile_deep_link: "https://www.tiktok.com/@celpip_practice",
          follower_count: 12431,
          following_count: 88,
          likes_count: 90210,
          video_count: 143,
        },
      },
    });

    expect(insights.username).toBe("celpip_practice");
    expect(insights.followers).toBe(12431);
    expect(insights.videos).toBe(143);
    expect(insights.missing).toEqual([]);
  });

  it("names the scope a connection is missing instead of reporting zero", () => {
    // What an app approved for the Display API but never asked for
    // user.info.stats gets back: the profile, and no counts at all.
    const insights = mapTikTokInsights({
      data: {
        user: {
          open_id: "abc",
          display_name: "Kerem",
          username: "celpip_practice",
          bio_description: "CELPIP tips",
        },
      },
    });

    expect(insights.followers).toBeNull();
    expect(insights.missing).toContain("user.info.stats");
    expect(insights.missing).not.toContain("user.info.profile");
  });

  it("falls back to a profile URL built from the username", () => {
    const insights = mapTikTokInsights({
      data: { user: { username: "kerem.onchain", follower_count: 3 } },
    });
    expect(insights.profileUrl).toBe("https://www.tiktok.com/@kerem.onchain");
  });

  it("survives an empty response rather than throwing at the panel", () => {
    const insights = mapTikTokInsights({});
    expect(insights.followers).toBeNull();
    expect(insights.profileUrl).toBeNull();
    expect(insights.missing).toContain("user.info.stats");
    expect(insights.missing).toContain("user.info.profile");
  });

  it("ignores counts that arrive as something other than numbers", () => {
    const insights = mapTikTokInsights({
      data: { user: { follower_count: "12431", video_count: null } },
    });
    expect(insights.followers).toBeNull();
    expect(insights.videos).toBeNull();
  });
});
