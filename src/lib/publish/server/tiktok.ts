import {
  completePublishJob,
  claimPublishJob,
  failPublishJob,
  findPublishJobClaim,
  notePublishJobPending,
  recordTikTokPublishId,
  type PublishJobClaim,
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
import {
  fetchTikTokPostStatus,
  TikTokPublishError,
  uploadTikTokDraft,
} from "@/lib/publish/tiktok";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { readTikTokPublishRequest } from "@/lib/publish/request";
import {
  type PublishWorkflow,
  persistPublishCompletion,
  publishFailureStatus,
  PublishOutcomeUnknownError,
} from "@/lib/publish/workflow";
import { getObjectFile, r2Configured } from "@/lib/r2";
import { MAX_DIRECT_VIDEO_UPLOAD_BYTES } from "@/lib/db/constants";

/**
 * Send a video (already in R2) to the user's TikTok drafts. This is the inbox
 * flow: TikTok receives the bytes and the video shows up in the user's TikTok
 * notifications to finish and publish there. No caption is applied here because
 * the user writes it in the app when they complete the post.
 */
export async function publishTikTok(
  req: Request,
  userId: string,
  workflow: PublishWorkflow,
  expectedAccountId?: string,
): Promise<Response> {
  const idempotencyKey = publishIdempotencyKey(req);
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  const prior = await findPublishJobClaim(userId, "tiktok", idempotencyKey);
  if (prior?.providerState?.mode === "direct")
    return Response.json({ error: "publish_mode_conflict" }, { status: 409 });
  if (prior)
    return reconcileTikTokClaim(prior, userId, workflow, expectedAccountId);
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
    accessToken = await getFreshAccessToken(
      userId,
      "tiktok",
      expectedAccountId,
    );
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const claim = await claimPublishJob(userId, {
    platform: "tiktok",
    providerState: { mode: "inbox" },
    mediaKey: media.mediaKey,
    idempotencyKey,
    caption: body.caption ?? null,
    contentItemId: body.contentItemId ?? null,
  });
  if (claim.kind === "unavailable") {
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  }
  if (claim.kind === "existing") {
    if (claim.providerState?.mode === "direct")
      return Response.json({ error: "publish_mode_conflict" }, { status: 409 });
    return reconcileTikTokClaim(claim, userId, workflow, expectedAccountId);
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
          onInitialized: (publishId) =>
            persistPublishCompletion(() =>
              recordTikTokPublishId(jobId, publishId),
            ),
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
        { error: "publish_state_pending", jobId, reconcilable: true },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "upload_failed";
    await failPublishJob(jobId, message).catch((failure) =>
      console.error("[publish] tiktok failure state write failed", failure),
    );
    console.error("[publish] tiktok upload failed", message);
    return Response.json(
      {
        error: "upload_failed",
        jobId,
        reason: e instanceof TikTokPublishError ? e.code : undefined,
      },
      { status: publishFailureStatus(e, workflow) },
    );
  }

  return checkTikTokDelivery(jobId, result.publishId, accessToken, workflow);
}

async function reconcileTikTokClaim(
  claim: Extract<PublishJobClaim, { kind: "existing" }>,
  userId: string,
  workflow: PublishWorkflow,
  expectedAccountId?: string,
): Promise<Response> {
  if (claim.status === "failed" || !claim.externalPostId) {
    return existingPublishResponse("tiktok", claim);
  }
  // Also verify historical "published" rows: older versions saved success
  // after the byte transfer, before TikTok confirmed inbox delivery.
  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(
      userId,
      "tiktok",
      expectedAccountId,
    );
  } catch (error) {
    if (error instanceof NoConnectionError)
      return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
  return checkTikTokDelivery(
    claim.jobId,
    claim.externalPostId,
    accessToken,
    workflow,
  );
}

async function checkTikTokDelivery(
  jobId: string,
  publishId: string,
  accessToken: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  let status: Awaited<ReturnType<typeof fetchTikTokPostStatus>>;
  try {
    status = await fetchTikTokPostStatus(accessToken, publishId, workflow);
  } catch (error) {
    // An unavailable status endpoint says nothing about delivery. Keep the
    // original claim and never initialize a replacement upload.
    await notePublishJobPending(
      jobId,
      error instanceof Error ? error.message : "tiktok_status_unavailable",
    ).catch(() => undefined);
    return pendingTikTokResponse(jobId);
  }
  if (status.status === "FAILED") {
    const reason = status.fail_reason ?? "upload_failed";
    await failPublishJob(jobId, `tiktok_${reason}`);
    return Response.json(
      { error: "upload_failed", jobId, reason },
      { status: 502 },
    );
  }
  if (
    status.status !== "SEND_TO_USER_INBOX" &&
    status.status !== "PUBLISH_COMPLETE"
  ) {
    await notePublishJobPending(jobId, `tiktok_${status.status}`).catch(
      () => undefined,
    );
    return pendingTikTokResponse(jobId);
  }
  try {
    await persistPublishCompletion(() =>
      completePublishJob(jobId, {
        externalPostId: publishId,
        externalUrl: "",
        draft: status.status !== "PUBLISH_COMPLETE",
      }),
    );
  } catch (error) {
    await notePublishJobPending(jobId, "completion_state_write_failed").catch(
      () => undefined,
    );
    console.error("[publish] tiktok completion state write failed", error);
    return pendingTikTokResponse(jobId);
  }
  return Response.json({
    jobId,
    publishId,
    draft: status.status !== "PUBLISH_COMPLETE",
  });
}

function pendingTikTokResponse(jobId: string): Response {
  return Response.json(
    { error: "publish_state_pending", jobId, reconcilable: true },
    { status: 503, headers: { "Retry-After": "5" } },
  );
}
