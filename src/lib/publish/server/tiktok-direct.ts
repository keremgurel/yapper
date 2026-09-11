import {
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
import { createTikTokMediaUrl } from "../media-grant";
import { readTikTokDirectRequest } from "../request";
import { readPublishVideoMetadata } from "../video-metadata";
import { fetchTikTokCreator, startTikTokDirectPost } from "../tiktok-direct";
import {
  validateTikTokDirectSettings,
  type TikTokDirectSettings,
} from "../tiktok-direct-settings";
import { fetchTikTokPostStatus, TikTokPublishError } from "../tiktok";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import {
  persistPublishCompletion,
  PublishOutcomeUnknownError,
  type PublishWorkflow,
} from "../workflow";
const pending = (jobId: string) =>
  Response.json(
    { error: "publish_state_pending", jobId, reconcilable: true },
    { status: 503, headers: { "Retry-After": "5" } },
  );

export async function publishTikTokDirect(
  req: Request,
  userId: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  const key = publishIdempotencyKey(req);
  if (!key)
    return Response.json({ error: "invalid_idempotency_key" }, { status: 400 });
  const prior = await findPublishJobClaim(userId, "tiktok", key);
  if (prior) return reconcile(prior, userId, workflow);
  let body;
  try {
    body = await readTikTokDirectRequest(req);
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok)
    return Response.json({ error: media.error }, { status: media.status });
  const settings = body.settings as TikTokDirectSettings | undefined;
  if (!settings?.accountId)
    return Response.json(
      { error: "tiktok_settings_required" },
      { status: 400 },
    );
  let accessToken: string;
  let username: string;
  try {
    accessToken = await getFreshAccessToken(
      userId,
      "tiktok",
      settings.accountId,
    );
    const [creator, video] = await Promise.all([
      fetchTikTokCreator(accessToken, workflow.signal),
      readPublishVideoMetadata(media.mediaKey, workflow.signal),
    ]);
    username = creator.creator_username;
    const invalid = validateTikTokDirectSettings(
      settings,
      creator,
      video.duration,
      process.env.TIKTOK_DIRECT_POST_AUDITED === "1",
    );
    if (invalid)
      return Response.json(
        { error: `tiktok_${invalid}`, reason: invalid },
        { status: 400 },
      );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "tiktok_preflight_failed",
        reason: error instanceof TikTokPublishError ? error.code : undefined,
      },
      { status: error instanceof NoConnectionError ? 409 : 502 },
    );
  }
  const state = {
    mode: "direct" as const,
    accountId: settings.accountId,
    username,
  };
  const claim = await claimPublishJob(userId, {
    platform: "tiktok",
    mediaKey: media.mediaKey,
    idempotencyKey: key,
    caption: body.caption,
    contentItemId: body.contentItemId,
    providerState: state,
  });
  if (claim.kind === "unavailable")
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  if (claim.kind === "existing") return reconcile(claim, userId, workflow);
  let publishId: string;
  try {
    publishId = await startTikTokDirectPost(
      {
        accessToken,
        videoUrl: createTikTokMediaUrl(media.mediaKey),
        caption: body.caption,
        settings,
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
      error instanceof Error ? error.message : "tiktok_publish_failed",
    );
    return Response.json(
      {
        error: "publish_failed",
        reason: error instanceof TikTokPublishError ? error.code : undefined,
      },
      { status: 502 },
    );
  }
  try {
    await persistPublishCompletion(() =>
      recordProviderPublishId(claim.jobId, publishId, state),
    );
  } catch {
    return pending(claim.jobId);
  }
  return checkDelivery(claim.jobId, publishId, accessToken, workflow, username);
}
async function reconcile(
  claim: Extract<PublishJobClaim, { kind: "existing" }>,
  userId: string,
  workflow: PublishWorkflow,
): Promise<Response> {
  if (claim.providerState?.mode !== "direct")
    return Response.json(
      { error: "publish_mode_conflict", jobId: claim.jobId },
      { status: 409 },
    );
  if (claim.status === "failed")
    return existingPublishResponse("tiktok", claim);
  if (claim.status === "published")
    return Response.json({
      jobId: claim.jobId,
      draft: false,
      url: claim.externalUrl || undefined,
      replayed: true,
    });
  const publishId = claim.providerState.publishId ?? claim.externalPostId;
  if (!publishId) return pending(claim.jobId);
  try {
    const token = await getFreshAccessToken(
      userId,
      "tiktok",
      claim.providerState.accountId,
    );
    return await checkDelivery(
      claim.jobId,
      publishId,
      token,
      workflow,
      claim.providerState.username,
    );
  } catch (error) {
    if (error instanceof NoConnectionError)
      return Response.json({ error: error.message }, { status: 409 });
    return pending(claim.jobId);
  }
}
async function checkDelivery(
  jobId: string,
  publishId: string,
  token: string,
  workflow: PublishWorkflow,
  username?: string,
): Promise<Response> {
  let status;
  try {
    status = await fetchTikTokPostStatus(token, publishId, workflow);
  } catch {
    return pending(jobId);
  }
  if (status.status === "FAILED") {
    const reason = status.fail_reason ?? "publish_failed";
    await failPublishJob(jobId, `tiktok_${reason}`);
    return Response.json(
      { error: "publish_failed", reason, jobId },
      { status: 502 },
    );
  }
  if (status.status !== "PUBLISH_COMPLETE") return pending(jobId);
  const rawId = status.publicaly_available_post_id?.[0];
  const id =
    typeof rawId === "string" && /^\d+$/.test(rawId)
      ? rawId
      : typeof rawId === "number" && Number.isSafeInteger(rawId)
        ? String(rawId)
        : undefined;
  const url =
    id && username
      ? `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${id}`
      : "";
  try {
    await persistPublishCompletion(() =>
      completePublishJob(jobId, {
        externalPostId: id ? String(id) : publishId,
        externalUrl: url,
      }),
    );
  } catch {
    return pending(jobId);
  }
  return Response.json({ jobId, draft: false, url: url || undefined });
}
