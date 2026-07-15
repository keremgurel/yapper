import { describe, expect, it } from "vitest";
import {
  crossPlatformViewStats,
  platformViewStats,
  type PlatformScrape,
} from "@/lib/dashboard/view-stats";
import type { Platform, ScrapedVideo } from "@/lib/inspiration/types";

function video(fields: Partial<ScrapedVideo>): ScrapedVideo {
  return {
    url: "https://x/v",
    title: "A post",
    views: 0,
    likes: 0,
    comments: 0,
    ...fields,
  };
}

function scrape(platform: Platform, videos: ScrapedVideo[]): PlatformScrape {
  return { platform, videos };
}

describe("platformViewStats", () => {
  it("sums views and likes and counts the videos", () => {
    const s = platformViewStats(
      scrape("tiktok", [
        video({ views: 100, likes: 10 }),
        video({ views: 250, likes: 5 }),
      ]),
    );
    expect(s).toEqual({
      platform: "tiktok",
      videoCount: 2,
      views: 350,
      likes: 15,
    });
  });

  it("is zeros for an empty feed", () => {
    expect(platformViewStats(scrape("youtube", []))).toEqual({
      platform: "youtube",
      videoCount: 0,
      views: 0,
      likes: 0,
    });
  });
});

describe("crossPlatformViewStats", () => {
  it("totals views and likes across every platform", () => {
    const out = crossPlatformViewStats([
      scrape("youtube", [video({ views: 1000, likes: 100 })]),
      scrape("tiktok", [video({ views: 500, likes: 40 })]),
    ]);
    expect(out.views).toBe(1500);
    expect(out.likes).toBe(140);
    expect(out.videoCount).toBe(2);
  });

  it("orders the per-platform breakdown biggest by views first", () => {
    const out = crossPlatformViewStats([
      scrape("tiktok", [video({ views: 500 })]),
      scrape("youtube", [video({ views: 1000 })]),
    ]);
    expect(out.perPlatform.map((p) => p.platform)).toEqual([
      "youtube",
      "tiktok",
    ]);
  });

  it("buckets views by the UTC month a post went up, summed across platforms, oldest first", () => {
    const out = crossPlatformViewStats([
      scrape("youtube", [
        video({ views: 10, postedAt: "2026-06-15T12:00:00.000Z" }),
        video({ views: 5, postedAt: "2026-07-02T00:00:00.000Z" }),
      ]),
      scrape("tiktok", [
        video({ views: 20, postedAt: "2026-07-20T00:00:00.000Z" }),
      ]),
    ]);
    expect(out.byMonth).toEqual([
      { month: "2026-06", views: 10 },
      { month: "2026-07", views: 25 },
    ]);
  });

  it("counts an undated post in the totals but leaves it out of the monthly series", () => {
    const out = crossPlatformViewStats([
      scrape("instagram", [
        video({ views: 7 }),
        video({ views: 3, postedAt: "not a date" }),
      ]),
    ]);
    expect(out.views).toBe(10);
    expect(out.byMonth).toEqual([]);
  });

  it("is all empty for no scrapes", () => {
    expect(crossPlatformViewStats([])).toEqual({
      views: 0,
      likes: 0,
      videoCount: 0,
      perPlatform: [],
      byMonth: [],
    });
  });
});
