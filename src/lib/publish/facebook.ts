import { fetchBoundedJson } from "@/lib/http/outbound";
import { facebookRequest, FacebookApiError } from "./facebook-api";
import {
  PublishOutcomeUnknownError,
  remainingPublishMs,
  type PublishWorkflow,
} from "./workflow";
export interface FacebookReelStatus {
  video_status?: string;
  uploading_phase?: { status?: string; error?: { message?: string } };
  processing_phase?: { status?: string; error?: { message?: string } };
  publishing_phase?: { status?: string; error?: { message?: string } };
}
export async function facebookReelStatus(
  videoId: string,
  token: string,
  signal: AbortSignal,
) {
  return facebookRequest<{ status?: FacebookReelStatus }>(
    `${encodeURIComponent(videoId)}?fields=status`,
    token,
    { signal },
  );
}
export async function postFacebookReel(
  input: {
    token: string;
    pageId: string;
    videoUrl: string;
    caption: string;
    onInitialized: (id: string) => Promise<void>;
  },
  workflow: PublishWorkflow,
): Promise<string> {
  const path = `${encodeURIComponent(input.pageId)}/video_reels`;
  const initialized = await facebookRequest<{
    video_id?: string;
    upload_url?: string;
  }>(path, input.token, {
    method: "POST",
    body: new URLSearchParams({ upload_phase: "start" }),
    signal: workflow.signal,
  });
  if (!initialized.video_id || !initialized.upload_url)
    throw new Error("facebook_init_invalid");
  const url = new URL(initialized.upload_url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "rupload.facebook.com" ||
    url.username ||
    url.password
  )
    throw new Error("facebook_upload_url_invalid");
  await input.onInitialized(initialized.video_id);
  try {
    const { response, data } = await fetchBoundedJson<{
      success?: boolean;
      error?: { code?: number; message?: string; is_transient?: boolean };
    }>(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `OAuth ${input.token}`,
          file_url: input.videoUrl,
        },
      },
      {
        timeoutMs: remainingPublishMs(workflow, 60_000),
        maxBytes: 64 * 1024,
        signal: workflow.signal,
      },
    );
    if (data.error)
      throw new FacebookApiError(
        data.error.code ?? response.status,
        data.error.message ?? "Upload rejected",
        response.status >= 500 || data.error.is_transient === true,
      );
    if (!response.ok || !data.success)
      throw new PublishOutcomeUnknownError("facebook");
    const finished = await facebookRequest<{ success?: boolean }>(
      path,
      input.token,
      {
        method: "POST",
        body: new URLSearchParams({
          upload_phase: "finish",
          video_id: initialized.video_id,
          video_state: "PUBLISHED",
          description: input.caption,
        }),
        signal: workflow.signal,
      },
    );
    if (!finished.success) throw new PublishOutcomeUnknownError("facebook");
  } catch (error) {
    if (error instanceof FacebookApiError && !error.uncertain) throw error;
    throw new PublishOutcomeUnknownError("facebook", error);
  }
  return initialized.video_id;
}
