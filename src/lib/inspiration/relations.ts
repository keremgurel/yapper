import { normalizeHandle } from "./platform";
import type { InspirationItem } from "./types";

/** Below this length a normalized key is too generic to trust: a 1-2 char handle
 * would substring-match half the library (e.g. "tj" inside "outjump"). */
const MIN_KEY = 3;

/** Normalize a set of raw name/handle/url strings into trustworthy match keys,
 * dropping blanks and anything too short to be distinctive. */
function matchKeys(values: (string | undefined)[]): string[] {
  return values.map(normalizeHandle).filter((k) => k.length >= MIN_KEY);
}

/** Do a creator's keys and a clip's keys plausibly name the same account? Loose
 * on purpose and BOTH ways (substring in either direction), since a creator's
 * display name and a clip's channel name often differ only by punctuation or a
 * trailing "Official". Shared by the grouping and the preselection so the two
 * can never disagree about what belongs to whom. */
function keysOverlap(creatorKeys: string[], clipKeys: string[]): boolean {
  return clipKeys.some((h) =>
    creatorKeys.some((k) => h.includes(k) || k.includes(h)),
  );
}

/** Every field that hints at who authored a clip, normalized. The url carries
 * the handle on TikTok/Instagram (`/@handle/...`), so it earns its place. */
function clipKeys(clip: {
  author?: string;
  handle?: string;
  url: string;
}): string[] {
  return matchKeys([clip.author, clip.handle, clip.url]);
}

/** Every field that names a saved creator, normalized. */
function creatorKeys(creator: InspirationItem): string[] {
  return matchKeys([creator.handle, creator.title, creator.author]);
}

/** Videos in the library that plausibly came from a given creator. We match on
 * a normalized handle/name because saved videos rarely carry a clean handle;
 * the oEmbed author is our best signal. */
export function videosByCreator(
  creator: InspirationItem,
  items: InspirationItem[],
): InspirationItem[] {
  const keys = creatorKeys(creator);

  return items.filter((it) => {
    if (it.kind !== "video") return false;
    // Explicit link always wins.
    if (it.creatorItemId) return it.creatorItemId === creator.id;
    if (keys.length === 0) return false;
    return keysOverlap(keys, clipKeys(it));
  });
}

/** Best-guess which saved creator a video belongs to, by matching the video's
 * author/handle/url to each creator's handle/name. Used to preselect the creator
 * when adding a clip. Uses the same predicate as videosByCreator, so a clip is
 * preselected under exactly the creator it will later be grouped with. Returns
 * the creator's item id, or null. */
export function guessCreatorForVideo(
  video: { author?: string; handle?: string; url: string },
  creators: InspirationItem[],
): string | null {
  const keys = clipKeys(video);
  if (keys.length === 0) return null;

  for (const creator of creators) {
    if (keysOverlap(creatorKeys(creator), keys)) return creator.id;
  }
  return null;
}
