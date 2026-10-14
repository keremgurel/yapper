import type { PublishPlatform } from "@/lib/db/schema";
import { enabledPublishPlatforms } from "@/lib/publish/availability";

/**
 * Connected platforms in the app's canonical order (the order of
 * `enabledPublishPlatforms`: YouTube, TikTok, Instagram), deduped, with any unknown id
 * dropped. Connections come back from the API in an arbitrary order, so this is
 * what keeps the compose picker, its default selection, and the post-to-all
 * fan-out all agreeing on which platform leads. Pure.
 */
export function connectedInOrder(
  connected: PublishPlatform[],
): PublishPlatform[] {
  const set = new Set(connected);
  return enabledPublishPlatforms.filter((p) => set.has(p));
}
