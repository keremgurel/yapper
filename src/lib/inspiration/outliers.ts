import type { ScrapedVideo } from "./types";

/** A video is an "outlier" when it clears this multiple of the creator's median
 * views — i.e. it meaningfully overperformed their baseline. */
const OUTLIER_MULTIPLE = 1.5;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Score each video against the creator's median views and flag the outliers.
 * Returns a new array sorted best-first: outliers by score desc, then the rest
 * by views desc. Videos with no view data keep score 0 and sort last. */
export function rankByOutlier(videos: ScrapedVideo[]): ScrapedVideo[] {
  const withViews = videos.filter((v) => v.views > 0).map((v) => v.views);
  const base = median(withViews);

  const scored = videos.map((v) => {
    const outlierScore = base > 0 && v.views > 0 ? v.views / base : 0;
    return {
      ...v,
      outlierScore,
      isOutlier: outlierScore >= OUTLIER_MULTIPLE,
    };
  });

  return scored.sort((a, b) => {
    if (b.outlierScore !== a.outlierScore)
      return b.outlierScore - a.outlierScore;
    return b.views - a.views;
  });
}
