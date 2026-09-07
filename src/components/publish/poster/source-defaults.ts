import type { CaptionSet } from "../captions/caption-draft";
import { defaultCover, type CoverDraft } from "./cover-draft";
import type { PosterVideo } from "./poster-video";

export function originalThumbnail(video: PosterVideo): string | undefined {
  if (
    video.kind !== "platform" ||
    video.platform !== "instagram" ||
    !video.thumbnail
  )
    return;
  // Same-origin bytes let the canvas export the original cover without CDN CORS restrictions.
  return `/api/publish/instagram/thumbnail?mediaId=${encodeURIComponent(video.sourceId)}`;
}

export function sourceCover(video: PosterVideo): CoverDraft {
  const draft = defaultCover(video.title);
  const image = originalThumbnail(video);
  return image ? { ...draft, source: "original", image } : draft;
}

export function sourceCaptions(video: PosterVideo): CaptionSet {
  if (video.kind !== "platform" || video.caption === undefined) return {};
  // Keep line breaks and inline hashtags exactly where the creator put them.
  return Object.fromEntries(
    (["youtube", "tiktok", "instagram"] as const).map((platform) => [
      platform,
      { platform, title: "", body: video.caption!, hashtags: [] },
    ]),
  );
}
