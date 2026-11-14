import type { TikTokPostChoices } from "@/lib/publish/tiktok-direct-defaults";
import type {
  TikTokDirectSettings,
  TikTokPrivacy,
} from "@/lib/publish/tiktok-direct-settings";

/** One video's TikTok choices, as the publish sheet reads them. */
export interface TikTokReview {
  mode: "direct" | "inbox";
  caption: string;
  /** Null until TikTok has said who is posting. */
  settings: TikTokPostChoices | null;
  /** Everything except the posting consent is in place. */
  ready: boolean;
  /** Still waiting on TikTok's posting options or the video's length. */
  loading: boolean;
}

export const TIKTOK_AUDIENCE_LABELS: Record<TikTokPrivacy, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

/** Who will see the post, in a word, for the line under the destinations. */
export function tiktokAudience(review?: TikTokReview): string {
  if (review?.mode === "inbox") return "Inbox draft";
  const privacy = review?.settings?.privacy;
  return (privacy && TIKTOK_AUDIENCE_LABELS[privacy]) || "Choose audience";
}

/**
 * The Direct Post body for a reviewed video, or null when it goes to the
 * inbox instead. Consent comes from the one confirmation beside the publish
 * button and the cover frame from the cover editor.
 */
export function tiktokDirectPost(
  review: TikTokReview | undefined,
  consent: boolean,
  coverTimestampMs?: number,
): { caption: string; settings: TikTokDirectSettings } | null {
  if (review?.mode !== "direct") return null;
  // A direct post without the account's reviewed choices must never fall
  // through and be delivered some other way.
  if (!review.settings) throw new Error("tiktok_settings_required");
  return {
    caption: review.caption,
    settings: { ...review.settings, consent, coverTimestampMs },
  };
}
