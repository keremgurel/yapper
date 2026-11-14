import { enabledPublishPlatforms } from "@/lib/publish/availability";
import type { PublishPlatform } from "@/lib/db/schema";
import type { CaptionSet } from "@/components/publish/captions/caption-draft";

export type PosterCopy = {
  caption?: string;
  title?: string;
  overrides?: Partial<Record<PublishPlatform, string>>;
  before?: Pick<PosterCopy, "caption" | "title">;
};

export function posterCaptions(copy: PosterCopy, original: string): CaptionSet {
  return Object.fromEntries(
    enabledPublishPlatforms.map((platform) => [
      platform,
      {
        platform,
        title: platform === "youtube" ? (copy.title ?? "") : "",
        body: copy.overrides?.[platform] ?? copy.caption ?? original,
        hashtags: [],
      },
    ]),
  );
}

/** Keep text edited while the request was running. A filled title is already the user's choice. */
export function applyPosterGeneration(
  copy: PosterCopy,
  original: string,
  initial: { caption: string; title: string },
  generated: { caption: string; title?: string },
): PosterCopy {
  const caption =
    (copy.caption ?? original) === initial.caption && generated.caption.trim()
      ? generated.caption
      : copy.caption;
  const title =
    (copy.title ?? "") === initial.title &&
    !initial.title.trim() &&
    generated.title?.trim()
      ? generated.title
      : copy.title;
  return caption === copy.caption && title === copy.title
    ? copy
    : {
        ...copy,
        caption,
        title,
        before: { caption: copy.caption, title: copy.title },
      };
}
