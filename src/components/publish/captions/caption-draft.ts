import type { PublishPlatform } from "@/lib/db/schema";
import { renderCaption, type PlatformCaption } from "@/lib/publish/caption";
import { captionSpec } from "@/lib/publish/caption-specs";

/**
 * One video's captions, keyed by platform.
 *
 * Partial on purpose: a creator writes only for the platforms this post is
 * going to, and an absent key is the honest way to say "not written yet"
 * rather than an empty caption that looks generated.
 */
export type CaptionSet = Partial<Record<PublishPlatform, PlatformCaption>>;

export function blankCaption(platform: PublishPlatform): PlatformCaption {
  return { platform, title: "", body: "", hashtags: [] };
}

export function captionFor(
  set: CaptionSet | undefined,
  platform: PublishPlatform,
): PlatformCaption {
  return set?.[platform] ?? blankCaption(platform);
}

export function hasCaptionText(caption: PlatformCaption): boolean {
  return Boolean(
    caption.title.trim() || caption.body.trim() || caption.hashtags.length,
  );
}

export function writtenPlatforms(set: CaptionSet | undefined): number {
  if (!set) return 0;
  return Object.values(set).filter(hasCaptionText).length;
}

/**
 * A hashtag in the shape the engine stores them: no hash, no separators.
 *
 * The hash is stripped rather than kept because `renderCaption` adds it back,
 * and a stored "#tag" renders as "##tag".
 */
export function toHashtag(raw: string): string {
  return raw
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, 60);
}

/** Append everything in `raw` as tags, skipping blanks and duplicates. */
export function addHashtags(tags: string[], raw: string): string[] {
  const added = raw
    .split(/[\s,]+/)
    .map(toHashtag)
    .filter(Boolean);
  const next = [...tags];
  for (const tag of added) if (!next.includes(tag)) next.push(tag);
  return next;
}

export function removeHashtag(tags: string[], tag: string): string[] {
  return tags.filter((existing) => existing !== tag);
}

/**
 * The rendered caption split where the platform collapses it behind "more".
 *
 * This is the only length that decides whether a scroller reads the post at
 * all, which is why it is shown instead of a character counter: the limit that
 * matters is not the one the API rejects.
 */
export function visibleSplit(caption: PlatformCaption): {
  shown: string;
  hidden: string;
} {
  const text = renderCaption(caption);
  const limit = captionSpec(caption.platform).visibleChars;
  return { shown: text.slice(0, limit), hidden: text.slice(limit) };
}

/**
 * How far past what the platform accepts this caption is, per field, so the
 * warning can say what to shorten instead of only that something is too long.
 */
export function captionOverBy(caption: PlatformCaption): {
  title: number;
  body: number;
} {
  const spec = captionSpec(caption.platform);
  return {
    title: Math.max(0, caption.title.length - spec.titleMax),
    body: Math.max(0, renderCaption(caption).length - spec.bodyMax),
  };
}
