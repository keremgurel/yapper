import { auth } from "@clerk/nextjs/server";
import {
  completePublishJob,
  claimPublishJob,
  failPublishJob,
  findPublishJobClaim,
  notePublishJobPending,
} from "@/lib/db/publish";
import { protectPendingThumbnail } from "@/lib/db/r2-lifecycle";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import {
  existingPublishResponse,
  publishIdempotencyKey,
} from "@/lib/publish/idempotency";
import { setYouTubeThumbnail, uploadYouTubeVideo } from "@/lib/publish/youtube";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { readYouTubePublishRequest } from "@/lib/publish/request";
import {
  createPublishWorkflow,
  persistPublishCompletion,
  publishFailureStatus,
  PublishOutcomeUnknownError,
} from "@/lib/publish/workflow";
import { getObjectFile, ownsKey, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Post a video (already in R2, by mediaKey) to the user's connected YouTube.
 * Records a publish_job either way, so a failure is inspectable rather than lost.
 */
export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const idempotencyKey = publishIdempotencyKey(req);
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  const prior = await findPublishJobClaim(userId, "youtube", idempotencyKey);
  if (prior) return existingPublishResponse("youtube", prior);
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  let body;
  try {
    body = await readYouTubePublishRequest(req);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const { title } = body;
  if (!title?.trim()) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok) {
    return Response.json({ error: media.error }, { status: media.status });
  }
  const mediaKey = media.mediaKey;
  const thumbnailKey =
    body.thumbnailKey &&
    ownsKey(userId, body.thumbnailKey) &&
    (await protectPendingThumbnail(
      userId,
      body.thumbnailKey,
      new Date(Date.now() + 2 * 60 * 60 * 1_000),
    ))
      ? body.thumbnailKey
      : undefined;

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "youtube");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const claim = await claimPublishJob(userId, {
    platform: "youtube",
    mediaKey,
    idempotencyKey,
    title,
    contentItemId: body.contentItemId ?? null,
  });
  if (claim.kind === "unavailable") {
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  }
  if (claim.kind === "existing") {
    return existingPublishResponse("youtube", claim);
  }
  const jobId = claim.jobId;

  let result: Awaited<ReturnType<typeof uploadYouTubeVideo>>;
  try {
    const file = await getObjectFile(mediaKey, { signal: workflow.signal });
    try {
      result = await uploadYouTubeVideo(
        {
          accessToken,
          filePath: file.filePath,
          byteLength: file.byteLength,
          contentType: file.contentType,
          title,
          description: body.description,
          tags: body.tags,
          privacyStatus: body.privacyStatus ?? "public",
        },
        workflow,
      );
    } finally {
      await file
        .cleanup()
        .catch((error) =>
          console.error(
            "[publish] youtube temporary file cleanup failed",
            error,
          ),
        );
    }
  } catch (e) {
    if (e instanceof PublishOutcomeUnknownError) {
      await notePublishJobPending(jobId, e.message).catch((failure) =>
        console.error("[publish] youtube pending state write failed", failure),
      );
      console.error("[publish] youtube outcome requires reconciliation", e);
      return Response.json(
        { error: "publish_state_pending", jobId },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "upload_failed";
    await failPublishJob(jobId, message).catch((failure) =>
      console.error("[publish] youtube failure state write failed", failure),
    );
    console.error("[publish] youtube upload failed", message);
    return Response.json(
      { error: "upload_failed", jobId },
      { status: publishFailureStatus(e, workflow) },
    );
  }

  try {
    await persistPublishCompletion(() =>
      completePublishJob(jobId, {
        externalPostId: result.videoId,
        externalUrl: result.url,
      }),
    );
  } catch (e) {
    await notePublishJobPending(jobId, "completion_state_write_failed").catch(
      () => undefined,
    );
    console.error("[publish] youtube completion state write failed", e);
    return Response.json(
      { error: "publish_state_pending", jobId },
      { status: 503 },
    );
  }

  // Custom thumbnail is best-effort: it needs a verified channel, so a failure
  // must not fail the post that already succeeded.
  if (thumbnailKey) {
    try {
      const thumb = await getObjectFile(thumbnailKey, {
        maxBytes: 20 * 1024 * 1024,
        signal: workflow.signal,
      });
      const mime = thumbnailKey.endsWith(".png") ? "image/png" : "image/jpeg";
      try {
        await setYouTubeThumbnail(
          {
            accessToken,
            videoId: result.videoId,
            filePath: thumb.filePath,
            byteLength: thumb.byteLength,
            mimeType: mime,
          },
          workflow,
        );
      } finally {
        await thumb.cleanup();
      }
    } catch (err) {
      console.error("[publish] youtube thumbnail failed", err);
    }
  }
  return Response.json({ jobId, ...result });
}
