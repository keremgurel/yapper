import { auth } from "@clerk/nextjs/server";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import {
  completePublishJob,
  claimPublishJob,
  failPublishJob,
  findPublishJobClaim,
  getConnectionRow,
  notePublishJobPending,
} from "@/lib/db/publish";
import { protectPendingThumbnail } from "@/lib/db/r2-lifecycle";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { postInstagramReel } from "@/lib/publish/instagram";
import {
  existingPublishResponse,
  publishIdempotencyKey,
} from "@/lib/publish/idempotency";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import { readInstagramPublishRequest } from "@/lib/publish/request";
import {
  createPublishWorkflow,
  persistPublishCompletion,
  publishFailureStatus,
  PublishOutcomeUnknownError,
} from "@/lib/publish/workflow";
import { ownsKey, presignView, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Post a video (already in R2) to the user's connected Instagram as a Reel.
 * Instagram pulls the video from a public URL, so we hand it a presigned R2 GET
 * that outlives the transcode. The account must be Professional (Business or
 * Creator); a personal account fails at the container step with a clear error.
 */
export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const idempotencyKey = publishIdempotencyKey(req);
  if (!idempotencyKey) {
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  }
  const prior = await findPublishJobClaim(userId, "instagram", idempotencyKey);
  if (prior) return existingPublishResponse("instagram", prior);
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  let body;
  try {
    body = await readInstagramPublishRequest(req);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok) {
    return Response.json({ error: media.error }, { status: media.status });
  }
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
  let igUserId: string | null;
  try {
    const row = await getConnectionRow(userId, "instagram");
    igUserId = row?.externalAccountId ?? null;
    accessToken = await getFreshAccessToken(userId, "instagram");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
  if (!igUserId) {
    return Response.json(
      { error: "instagram_reauth_required" },
      { status: 409 },
    );
  }

  const claim = await claimPublishJob(userId, {
    platform: "instagram",
    mediaKey: media.mediaKey,
    idempotencyKey,
    caption: body.caption ?? null,
    contentItemId: body.contentItemId ?? null,
  });
  if (claim.kind === "unavailable") {
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  }
  if (claim.kind === "existing") {
    return existingPublishResponse("instagram", claim);
  }
  const jobId = claim.jobId;

  let result: Awaited<ReturnType<typeof postInstagramReel>>;
  try {
    const videoUrl = await presignView(media.mediaKey, 3600);
    // A custom cover, if the client uploaded one under the user's own prefix.
    const coverUrl = thumbnailKey
      ? await presignView(thumbnailKey, 3600)
      : undefined;
    result = await postInstagramReel(
      {
        accessToken,
        igUserId,
        videoUrl,
        caption: body.caption,
        coverUrl,
      },
      workflow,
    );
  } catch (e) {
    if (e instanceof PublishOutcomeUnknownError) {
      await notePublishJobPending(jobId, e.message).catch((failure) =>
        console.error(
          "[publish] instagram pending state write failed",
          failure,
        ),
      );
      console.error("[publish] instagram outcome requires reconciliation", e);
      return Response.json(
        { error: "publish_state_pending", jobId },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "publish_failed";
    await failPublishJob(jobId, message).catch((failure) =>
      console.error("[publish] instagram failure state write failed", failure),
    );
    console.error("[publish] instagram publish failed", message);
    const professional = message.includes("instagram_container_");
    return Response.json(
      {
        error: professional ? "not_professional" : "publish_failed",
        jobId,
      },
      { status: publishFailureStatus(e, workflow) },
    );
  }

  try {
    await persistPublishCompletion(() =>
      completePublishJob(jobId, {
        externalPostId: result.mediaId,
        externalUrl: result.url,
      }),
    );
  } catch (e) {
    await notePublishJobPending(jobId, "completion_state_write_failed").catch(
      () => undefined,
    );
    console.error("[publish] instagram completion state write failed", e);
    return Response.json(
      { error: "publish_state_pending", jobId },
      { status: 503 },
    );
  }
  return Response.json({ jobId, ...result });
}
