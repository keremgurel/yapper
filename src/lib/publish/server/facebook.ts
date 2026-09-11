import {
  getConnectionRow,
  claimPublishJob,
  findPublishJobClaim,
  completePublishJob,
  recordProviderPublishId,
  failPublishJob,
  notePublishJobPending,
  type PublishJobClaim,
} from "@/lib/db/publish";
import { getFreshAccessToken, NoConnectionError } from "../connection";
import { existingPublishResponse, publishIdempotencyKey } from "../idempotency";
import { resolveOwnedMediaKey } from "../media";
import { readFacebookPublishRequest } from "../request";
import { readPublishVideoMetadata } from "../video-metadata";
import { postFacebookReel, facebookReelStatus } from "../facebook";
import { FacebookApiError } from "../facebook-api";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import {
  persistPublishCompletion,
  PublishOutcomeUnknownError,
  type PublishWorkflow,
} from "../workflow";
import { presignView } from "@/lib/r2";
const pending = (jobId: string) =>
  Response.json(
    { error: "publish_state_pending", jobId, reconcilable: true },
    { status: 503, headers: { "Retry-After": "5" } },
  );
export async function publishFacebook(
  req: Request,
  userId: string,
  workflow: PublishWorkflow,
  expectedAccountId?: string,
): Promise<Response> {
  const key = publishIdempotencyKey(req);
  if (!key)
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  const prior = await findPublishJobClaim(userId, "facebook", key);
  if (prior) return reconcile(prior, userId, workflow);
  let body;
  try {
    body = await readFacebookPublishRequest(req);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok)
    return Response.json({ error: media.error }, { status: media.status });
  const connection = await getConnectionRow(userId, "facebook");
  if (!connection?.externalAccountId)
    return Response.json({ error: "facebook_page_required" }, { status: 409 });
  const requestedAccount = expectedAccountId ?? body.expectedAccountId;
  if (!requestedAccount)
    return Response.json({ error: "facebook_page_required" }, { status: 400 });
  if (connection.externalAccountId !== requestedAccount)
    return Response.json(
      { error: "facebook_account_changed" },
      { status: 409 },
    );
  let token: string;
  try {
    token = await getFreshAccessToken(
      userId,
      "facebook",
      connection.externalAccountId,
    );
    const video = await readPublishVideoMetadata(
      media.mediaKey,
      workflow.signal,
    );
    if (
      video.duration < 3 ||
      video.duration > 90 ||
      video.width < 540 ||
      video.height < 960 ||
      Math.abs(video.width / video.height - 9 / 16) > 0.02
    )
      return Response.json(
        { error: "facebook_video_requirements", reason: "video_requirements" },
        { status: 400 },
      );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "facebook_preflight_failed",
      },
      { status: error instanceof NoConnectionError ? 409 : 502 },
    );
  }
  const state = {
    mode: "direct" as const,
    accountId: connection.externalAccountId,
  };
  const claim = await claimPublishJob(userId, {
    platform: "facebook",
    mediaKey: media.mediaKey,
    idempotencyKey: key,
    caption: body.caption,
    contentItemId: body.contentItemId,
    providerState: state,
  });
  if (claim.kind === "unavailable")
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  if (claim.kind === "existing") return reconcile(claim, userId, workflow);
  let videoId: string;
  try {
    videoId = await postFacebookReel(
      {
        token,
        pageId: connection.externalAccountId,
        videoUrl: await presignView(media.mediaKey, 3600),
        caption: body.caption ?? "",
        onInitialized: (id) =>
          persistPublishCompletion(() =>
            recordProviderPublishId(claim.jobId, id, state),
          ),
      },
      workflow,
    );
  } catch (error) {
    if (error instanceof PublishOutcomeUnknownError) {
      await notePublishJobPending(claim.jobId, error.message);
      return pending(claim.jobId);
    }
    await failPublishJob(
      claim.jobId,
      error instanceof Error ? error.message : "facebook_publish_failed",
    );
    return Response.json(
      {
        error: "publish_failed",
        message: error instanceof FacebookApiError ? error.detail : undefined,
      },
      { status: 502 },
    );
  }
  return checkDelivery(claim.jobId, videoId, token, workflow);
}
async function reconcile(
  claim: Extract<PublishJobClaim, { kind: "existing" }>,
  userId: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  if (claim.status === "published" || claim.status === "failed")
    return existingPublishResponse("facebook", claim);
  if (!claim.externalPostId) return pending(claim.jobId);
  try {
    const token = await getFreshAccessToken(
      userId,
      "facebook",
      claim.providerState?.accountId,
    );
    return await checkDelivery(
      claim.jobId,
      claim.externalPostId,
      token,
      workflow,
    );
  } catch (error) {
    if (error instanceof NoConnectionError)
      return Response.json({ error: error.message }, { status: 409 });
    return pending(claim.jobId);
  }
}
async function checkDelivery(
  jobId: string,
  videoId: string,
  token: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  let status;
  try {
    status = (await facebookReelStatus(videoId, token, workflow.signal)).status;
  } catch {
    return pending(jobId);
  }
  const phases = [
    status?.uploading_phase,
    status?.processing_phase,
    status?.publishing_phase,
  ];
  const failure = phases.find(
    (p) => p?.error || p?.status === "error" || p?.status === "failed",
  );
  if (status?.video_status === "error" || failure) {
    const message =
      failure?.error?.message ?? "Facebook could not process this video.";
    await failPublishJob(jobId, `facebook_${message}`);
    return Response.json(
      { error: "publish_failed", message, jobId },
      { status: 502 },
    );
  }
  if (status?.publishing_phase?.status !== "complete") return pending(jobId);
  const url = `https://www.facebook.com/reel/${videoId}`;
  try {
    await persistPublishCompletion(() =>
      completePublishJob(jobId, { externalPostId: videoId, externalUrl: url }),
    );
  } catch {
    return pending(jobId);
  }
  return Response.json({ jobId, url });
}
