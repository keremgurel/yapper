import { getFreshAccessToken } from "../connection";
import { fetchTikTokCreator } from "../tiktok-direct";
import {
  validateTikTokDirectSettings,
  type TikTokDirectSettings,
} from "../tiktok-direct-settings";
import { readPublishVideoMetadata } from "../video-metadata";

/**
 * Runs Direct Post's creator and length checks when a TikTok post is
 * scheduled, so a setting TikTok would refuse fails while the creator is still
 * looking, not at 9am tomorrow. Send time checks again against whatever the
 * creator's TikTok settings are by then.
 *
 * Returns an error code in the direct route's `tiktok_<reason>` form, or null.
 */
export async function preflightScheduledTikTok(
  userId: string,
  mediaKey: string,
  settings: TikTokDirectSettings,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const token = await getFreshAccessToken(
      userId,
      "tiktok",
      settings.accountId,
    );
    const [creator, video] = await Promise.all([
      fetchTikTokCreator(token, signal),
      readPublishVideoMetadata(mediaKey, signal),
    ]);
    const invalid = validateTikTokDirectSettings(
      settings,
      creator,
      video.duration,
      process.env.TIKTOK_DIRECT_POST_AUDITED === "1",
    );
    return invalid ? `tiktok_${invalid}` : null;
  } catch {
    return "tiktok_preflight_failed";
  }
}
