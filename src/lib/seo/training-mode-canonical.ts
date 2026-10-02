import { PUBLIC_PATHS } from "./public-routes";

/**
 * `/training?mode=<slug>` opens an exercise inside the practice hub. It is a
 * UI state, not a page of its own, so search engines are pointed at the
 * exercise's real page when it has one. Returns null for a mode that has no
 * page; the caller keeps that state out of the index instead.
 */
export function trainingModeCanonical(slug: string): string | null {
  return (
    [`/training/${slug}`, `/${slug}`].find((path) =>
      PUBLIC_PATHS.includes(path),
    ) ?? null
  );
}
