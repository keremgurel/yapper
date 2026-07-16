import { describe, expect, it } from "vitest";
import { rankByOutlier } from "@/lib/inspiration/outliers";
import type { ScrapedVideo } from "@/lib/inspiration/types";

const vid = (views: number, url: string): ScrapedVideo => ({
  url,
  title: url,
  views,
  likes: 0,
  comments: 0,
});

describe("rankByOutlier", () => {
  it("returns an empty array for no videos", () => {
    expect(rankByOutlier([])).toEqual([]);
  });

  it("excludes zero-view videos from the median baseline", () => {
    // withViews = [100, 200] -> median 150, so the 200 sits at 1.33x (NOT an
    // outlier). If the 0-view video were counted, the median would drop to 100
    // and the 200 would wrongly read as a 2.0x outlier.
    const out = rankByOutlier([vid(200, "a"), vid(100, "b"), vid(0, "c")]);
    const a = out.find((v) => v.url === "a")!;
    expect(a.outlierScore).toBeCloseTo(200 / 150, 6);
    expect(a.isOutlier).toBe(false);
  });

  it("flags a video at exactly 1.5x the median as an outlier", () => {
    // median([100,200,300]) = 200; 300/200 = 1.5, the inclusive threshold.
    const out = rankByOutlier([vid(300, "a"), vid(200, "b"), vid(100, "c")]);
    const a = out.find((v) => v.url === "a")!;
    const b = out.find((v) => v.url === "b")!;
    expect(a.outlierScore).toBe(1.5);
    expect(a.isOutlier).toBe(true);
    expect(b.isOutlier).toBe(false); // 1.0x is not an outlier
  });

  it("sorts best-first and drops no-view videos to the end", () => {
    const out = rankByOutlier([
      vid(0, "z"),
      vid(200, "b"),
      vid(50, "c"),
      vid(300, "a"),
    ]);
    expect(out.map((v) => v.url)).toEqual(["a", "b", "c", "z"]);
  });

  it("scores nothing when no video has views", () => {
    const out = rankByOutlier([vid(0, "a"), vid(0, "b")]);
    expect(out.every((v) => v.outlierScore === 0 && !v.isOutlier)).toBe(true);
  });
});
