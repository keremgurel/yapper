import { normalizeHandle } from "./platform";
import type { InspirationItem } from "./types";

/** Videos in the library that plausibly came from a given creator. We match on
 * a normalized handle/name because saved videos rarely carry a clean handle —
 * the oEmbed author is our best signal. Kept loose on purpose (substring both
 * ways) since a creator's display name and a video's channel name often differ
 * only in punctuation or a trailing "Official". */
export function videosByCreator(
  creator: InspirationItem,
  items: InspirationItem[],
): InspirationItem[] {
  const keys = [creator.handle, creator.title, creator.author]
    .map(normalizeHandle)
    .filter((k) => k.length >= 3);

  return items.filter((it) => {
    if (it.kind !== "video") return false;
    // Explicit link always wins.
    if (it.creatorItemId) return it.creatorItemId === creator.id;
    // Fall back to author-name matching only for unlinked clips. Both sides are
    // held to >= 3 chars so a 1-2 char handle can't spuriously substring-match
    // an unrelated creator (e.g. "tj" inside "outjump").
    if (keys.length === 0) return false;
    const hay = [it.author, it.handle]
      .map(normalizeHandle)
      .filter((h) => h.length >= 3);
    return hay.some((h) => keys.some((k) => h.includes(k) || k.includes(h)));
  });
}

/** Best-guess which saved creator a video belongs to, by matching the video's
 * author/handle to each creator's handle/name. Used to preselect the creator
 * when adding a clip. Returns the creator's item id, or null. */
export function guessCreatorForVideo(
  video: { author?: string; handle?: string; url: string },
  creators: InspirationItem[],
): string | null {
  const hay = [video.author, video.handle, video.url]
    .map(normalizeHandle)
    .filter((h) => h.length >= 3);
  if (hay.length === 0) return null;

  for (const creator of creators) {
    const keys = [creator.handle, creator.title, creator.author]
      .map(normalizeHandle)
      .filter((k) => k.length >= 3);
    if (keys.some((k) => hay.some((h) => h.includes(k)))) return creator.id;
  }
  return null;
}
