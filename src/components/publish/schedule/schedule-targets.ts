import type { PublishPlatform } from "@/lib/db/schema";
import type { ScheduleRequest } from "@/lib/publish/schedule-client";
import { outgoingCopy, type CopyOverride } from "../outgoing-copy";
import type { CrossPostTarget } from "../compose/types";
import type { TikTokReview } from "../tiktok-post-review";
import type { YouTubeSettings } from "../youtube-settings";

/**
 * The saved request for each video and destination: the same copy, cover and
 * settings a "Post now" would send, frozen for later. TikTok carries its
 * reviewed Direct Post settings, or nothing at all for a draft.
 */
export function scheduleTargets(
  sources: CrossPostTarget[],
  platforms: PublishPlatform[],
  {
    override,
    accounts,
    youtubeSettings,
    tiktokReviews,
  }: {
    override: CopyOverride | null;
    accounts: Partial<Record<PublishPlatform, string>>;
    youtubeSettings: YouTubeSettings;
    tiktokReviews: Record<string, TikTokReview>;
  },
): ScheduleRequest["targets"] {
  return sources.flatMap((source) =>
    platforms.map((platform) => {
      const copy = outgoingCopy(source, platform, override);
      const review = tiktokReviews[source.id];
      return {
        platform,
        expectedAccountId: accounts[platform] ?? "",
        input: {
          submissionId: source.submissionId,
          mediaKey: source.mediaKey,
          contentItemId: source.contentItemId,
          thumbnailKey: source.thumbnailKey,
          ...(platform === "youtube"
            ? {
                title: copy.title,
                description: copy.body || undefined,
                privacyStatus: youtubeSettings.privacyStatus,
                selfDeclaredMadeForKids:
                  youtubeSettings.selfDeclaredMadeForKids ?? undefined,
                containsSyntheticMedia: youtubeSettings.containsSyntheticMedia,
              }
            : platform === "instagram" || platform === "facebook"
              ? { caption: copy.body || copy.title || undefined }
              : review?.mode === "direct"
                ? { caption: review.caption, settings: review.settings }
                : {}),
        },
      };
    }),
  );
}
