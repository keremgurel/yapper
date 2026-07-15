import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

/**
 * Connected platforms in the app's canonical order (the order of
 * `publishPlatforms`: YouTube, TikTok, Instagram), deduped, with any unknown id
 * dropped. Connections come back from the API in an arbitrary order, so this is
 * what keeps the compose picker, its default selection, and the post-to-all
 * fan-out all agreeing on which platform leads. Pure.
 */
export function connectedInOrder(
  connected: PublishPlatform[],
): PublishPlatform[] {
  const set = new Set(connected);
  return publishPlatforms.filter((p) => set.has(p));
}
