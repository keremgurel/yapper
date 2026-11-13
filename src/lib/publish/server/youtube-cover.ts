import { findPublishJobClaim } from "@/lib/db/publish";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { publishIdempotencyKey } from "@/lib/publish/idempotency";
import { readYouTubeCoverRequest } from "@/lib/publish/request";
import type { PublishWorkflow } from "@/lib/publish/workflow";
import {
  setYouTubeThumbnail,
  waitForYouTubeProcessing,
} from "@/lib/publish/youtube";
import { getObjectFile, ownsKey } from "@/lib/r2";

/**
 * Set a video's custom thumbnail once YouTube has processed it. Best effort:
 * the channel may not be allowed custom thumbnails, and the video is already
 * live either way, so this answers whether the cover took and never throws.
 */
export async function applyYouTubeThumbnail(
  accessToken: string,
  videoId: string,
  thumbnailKey: string,
  workflow: PublishWorkflow,
): Promise<boolean> {
  try {
    await waitForYouTubeProcessing(accessToken, videoId, workflow);
    const thumb = await getObjectFile(thumbnailKey, {
      maxBytes: 20 * 1024 * 1024,
      signal: workflow.signal,
    });
    try {
      await setYouTubeThumbnail(
        {
          accessToken,
          videoId,
          filePath: thumb.filePath,
          byteLength: thumb.byteLength,
          mimeType: thumbnailKey.endsWith(".png") ? "image/png" : "image/jpeg",
        },
        workflow,
      );
      return true;
    } finally {
      await thumb.cleanup();
    }
  } catch (error) {
    console.error("[publish] youtube thumbnail failed", error);
    return false;
  }
}

/**
 * The second half of a publish that deferred its cover. The caller sends the
 * idempotency key of the upload it just made, which names the user's own
 * published video; nothing here can touch a video they did not post.
 */
export async function publishYouTubeCover(
  req: Request,
  userId: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  const idempotencyKey = publishIdempotencyKey(req);
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  let thumbnailKey: string;
  try {
    ({ thumbnailKey } = await readYouTubeCoverRequest(req));
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  if (!ownsKey(userId, thumbnailKey)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const job = await findPublishJobClaim(userId, "youtube", idempotencyKey);
  if (job?.status !== "published" || !job.externalPostId) {
    return Response.json({ error: "publish_not_complete" }, { status: 409 });
  }
  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "youtube");
  } catch (error) {
    if (error instanceof NoConnectionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  return Response.json({
    coverApplied: await applyYouTubeThumbnail(
      accessToken,
      job.externalPostId,
      thumbnailKey,
      workflow,
    ),
  });
}
