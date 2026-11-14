import type { PublishPlatform } from "@/lib/db/schema";
import {
  applyYouTubeCover,
  crossPostToFacebook,
  crossPostToInstagram,
  crossPostToTikTok,
  crossPostToTikTokDirect,
  crossPostToYouTube,
  type CrossPostResult,
} from "@/lib/publish/client";
import type { CrossPostTarget } from "../compose/types";
import { outgoingCopy, type CopyOverride } from "../outgoing-copy";
import { tiktokDirectPost, type TikTokReview } from "../tiktok/tiktok-review";
import type { YouTubeSettings } from "../youtube-settings";

export interface PostSourceOptions {
  override: CopyOverride | null;
  tiktokReview?: TikTokReview;
  expectedAccountId?: string;
  youtubeSettings?: YouTubeSettings;
  /** The creator's tick on the posting declaration. */
  consent: boolean;
  /** Handed the cover request when YouTube answers before its cover is set,
   * so the post can be reported live without waiting on it. */
  onCover?: (applied: Promise<boolean>) => void;
}

/** Send one video to one platform, with that platform's copy and settings. */
export async function postSource(
  source: CrossPostTarget,
  platform: PublishPlatform,
  idempotencyKey: string,
  {
    override,
    tiktokReview,
    expectedAccountId,
    youtubeSettings,
    consent,
    onCover,
  }: PostSourceOptions,
): Promise<CrossPostResult> {
  const { title, body } = outgoingCopy(source, platform, override);
  if (platform === "youtube") {
    const result = await crossPostToYouTube(
      {
        submissionId: source.submissionId,
        mediaKey: source.mediaKey,
        title,
        description: body || undefined,
        contentItemId: source.contentItemId,
        thumbnailKey: source.thumbnailKey,
        privacyStatus: youtubeSettings?.privacyStatus ?? "public",
        selfDeclaredMadeForKids:
          youtubeSettings?.selfDeclaredMadeForKids ?? undefined,
        containsSyntheticMedia: youtubeSettings?.containsSyntheticMedia,
        deferCover: Boolean(onCover && source.thumbnailKey),
      },
      idempotencyKey,
    );
    if (result.coverPending && source.thumbnailKey)
      onCover?.(applyYouTubeCover(source.thumbnailKey, idempotencyKey));
    return result;
  }
  if (platform === "instagram" || platform === "facebook") {
    const input = {
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      caption: body || title || undefined,
      contentItemId: source.contentItemId,
      thumbnailKey: source.thumbnailKey,
    };
    return platform === "facebook"
      ? crossPostToFacebook(
          { ...input, expectedAccountId: expectedAccountId ?? "" },
          idempotencyKey,
        )
      : crossPostToInstagram(input, idempotencyKey);
  }
  const direct = tiktokDirectPost(
    tiktokReview,
    consent,
    source.coverTimestampMs,
  );
  if (direct)
    return crossPostToTikTokDirect(
      {
        submissionId: source.submissionId,
        mediaKey: source.mediaKey,
        contentItemId: source.contentItemId,
        ...direct,
      },
      idempotencyKey,
    );
  // TikTok's inbox endpoint takes no caption at all: the video lands in the
  // creator's drafts and they paste the caption in the app.
  return crossPostToTikTok(
    {
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      contentItemId: source.contentItemId,
    },
    idempotencyKey,
  );
}
