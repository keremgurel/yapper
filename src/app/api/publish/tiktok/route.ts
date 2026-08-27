import { auth } from "@clerk/nextjs/server";
import {
  completePublishJob,
  claimPublishJob,
  failPublishJob,
  findPublishJobClaim,
  notePublishJobPending,
} from "@/lib/db/publish";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import {
  existingPublishResponse,
  publishIdempotencyKey,
} from "@/lib/publish/idempotency";
import { uploadTikTokDraft } from "@/lib/publish/tiktok";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { readTikTokPublishRequest } from "@/lib/publish/request";
import {
  createPublishWorkflow,
  persistPublishCompletion,
  publishFailureStatus,
  PublishOutcomeUnknownError,
} from "@/lib/publish/workflow";
import { getObjectFile, r2Configured } from "@/lib/r2";
import { MAX_DIRECT_VIDEO_UPLOAD_BYTES } from "@/lib/db/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Send a video (already in R2) to the user's TikTok drafts. This is the inbox
 * flow: TikTok receives the bytes and the video shows up in the user's TikTok
 * notifications to finish and publish there. No caption is applied here because
 * the user writes it in the app when they complete the post.
 */
export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const idempotencyKey = publishIdempotencyKey(req);
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  const prior = await findPublishJobClaim(userId, "tiktok", idempotencyKey);
  if (prior) return existingPublishResponse("tiktok", prior);
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  let body;
  try {
    body = await readTikTokPublishRequest(req);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok) {
    return Response.json({ error: media.error }, { status: media.status });
  }

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "tiktok");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const claim = await claimPublishJob(userId, {
    platform: "tiktok",
    mediaKey: media.mediaKey,
    idempotencyKey,
    caption: body.caption ?? null,
    contentItemId: body.contentItemId ?? null,
  });
  if (claim.kind === "unavailable") {
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  }
  if (claim.kind === "existing") {
    return existingPublishResponse("tiktok", claim);
  }
  const jobId = claim.jobId;

  let result: Awaited<ReturnType<typeof uploadTikTokDraft>>;
  try {
    const file = await getObjectFile(media.mediaKey, {
      maxBytes: MAX_DIRECT_VIDEO_UPLOAD_BYTES,
      signal: workflow.signal,
    });
    try {
      result = await uploadTikTokDraft(
        {
          accessToken,
          filePath: file.filePath,
          byteLength: file.byteLength,
          contentType: file.contentType,
        },
        workflow,
      );
    } finally {
      await file
        .cleanup()
        .catch((error) =>
          console.error(
            "[publish] tiktok temporary file cleanup failed",
            error,
          ),
        );
    }
  } catch (e) {
    if (e instanceof PublishOutcomeUnknownError) {
      await notePublishJobPending(jobId, e.message).catch((failure) =>
        console.error("[publish] tiktok pending state write failed", failure),
      );
      console.error("[publish] tiktok outcome requires reconciliation", e);
      return Response.json(
        { error: "publish_state_pending", jobId },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "upload_failed";
    await failPublishJob(jobId, message).catch((failure) =>
      console.error("[publish] tiktok failure state write failed", failure),
    );
    console.error("[publish] tiktok upload failed", message);
    return Response.json(
      { error: "upload_failed", jobId },
      { status: publishFailureStatus(e, workflow) },
    );
  }

  try {
    // A draft has no public URL yet — the user finishes posting in the app.
    await persistPublishCompletion(() =>
      completePublishJob(jobId, {
        externalPostId: result.publishId,
        externalUrl: "",
      }),
    );
  } catch (e) {
    // TikTok accepted the media. Never rewrite this job to failed: a new key
    // could create a duplicate draft. The existing claim remains in progress.
    await notePublishJobPending(jobId, "completion_state_write_failed").catch(
      () => undefined,
    );
    console.error("[publish] tiktok completion state write failed", e);
    return Response.json(
      { error: "publish_state_pending", jobId },
      { status: 503 },
    );
  }
  return Response.json({ jobId, publishId: result.publishId, draft: true });
}
