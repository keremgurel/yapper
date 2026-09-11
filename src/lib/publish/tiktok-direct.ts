import { fetchBoundedJson } from "@/lib/http/outbound";
import { TikTokPublishError } from "./tiktok";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";
import type {
  TikTokCreator,
  TikTokDirectSettings,
} from "./tiktok-direct-settings";
export async function fetchTikTokCreator(
  accessToken: string,
  signal?: AbortSignal,
): Promise<TikTokCreator> {
  const { response, data } = await fetchBoundedJson<{
    data?: TikTokCreator;
    error?: { code?: string; log_id?: string };
  }>(
    "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    },
    { timeoutMs: 15_000, maxBytes: 64 * 1024, signal },
  );
  if (!response.ok || (data.error?.code && data.error.code !== "ok"))
    throw new TikTokPublishError(
      data.error?.code ?? `creator_${response.status}`,
      data.error?.log_id,
    );
  const creator = data.data;
  if (
    !creator ||
    typeof creator.creator_nickname !== "string" ||
    typeof creator.creator_username !== "string" ||
    !Array.isArray(creator.privacy_level_options) ||
    !Number.isFinite(creator.max_video_post_duration_sec) ||
    creator.max_video_post_duration_sec <= 0 ||
    [
      creator.comment_disabled,
      creator.duet_disabled,
      creator.stitch_disabled,
    ].some((v) => typeof v !== "boolean")
  )
    throw new TikTokPublishError("creator_invalid");
  return creator;
}
export async function startTikTokDirectPost(
  input: {
    accessToken: string;
    videoUrl: string;
    caption: string;
    settings: TikTokDirectSettings;
  },
  workflow: PublishWorkflow,
): Promise<string> {
  try {
    const s = input.settings;
    const { response, data } = await fetchBoundedJson<{
      data?: { publish_id?: string };
      error?: { code?: string; log_id?: string };
    }>(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: input.caption,
            privacy_level: s.privacy,
            disable_comment: !s.allowComment,
            disable_duet: !s.allowDuet,
            disable_stitch: !s.allowStitch,
            brand_content_toggle: s.brandedContent,
            brand_organic_toggle: s.ownBrand,
            is_aigc: s.aiGenerated,
          },
          source_info: { source: "PULL_FROM_URL", video_url: input.videoUrl },
        }),
      },
      {
        timeoutMs: remainingPublishMs(workflow, 20_000),
        maxBytes: 64 * 1024,
        signal: workflow.signal,
      },
    );
    if (response.status >= 500 || data.error?.code === "internal_error")
      throw new PublishOutcomeUnknownError("tiktok");
    if (data.error?.code && data.error.code !== "ok")
      throw new TikTokPublishError(data.error.code, data.error.log_id);
    if (!response.ok || !data.data?.publish_id)
      throw new PublishOutcomeUnknownError("tiktok");
    return data.data.publish_id;
  } catch (error) {
    if (error instanceof TikTokPublishError) throw error;
    throw new PublishOutcomeUnknownError("tiktok", error);
  }
}
