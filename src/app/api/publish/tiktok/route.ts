import { auth } from "@clerk/nextjs/server";
import {
  completePublishJob,
  claimPublishJob,
  failPublishJob,
  findPublishJobClaim,
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
import { getObjectBytes, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Send a video (already in R2) to the user's TikTok drafts. This is the inbox
 * flow: TikTok receives the bytes and the video shows up in the user's TikTok
 * notifications to finish and publish there. No caption is applied here because
 * the user writes it in the app when they complete the post.
 */
export async function POST(req: Request): Promise<Response> {
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

  const body = (await req.json().catch(() => ({}))) as {
    submissionId?: string;
    mediaKey?: string;
    caption?: string;
    contentItemId?: string;
  };

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

  try {
    const bytes = await getObjectBytes(media.mediaKey);
    const result = await uploadTikTokDraft({ accessToken, bytes });
    // A draft has no public URL yet — the user finishes posting in the app.
    await completePublishJob(jobId, {
      externalPostId: result.publishId,
      externalUrl: "",
    });
    return Response.json({ jobId, publishId: result.publishId, draft: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload_failed";
    await failPublishJob(jobId, message);
    console.error("[publish] tiktok upload failed", message);
    return Response.json({ error: "upload_failed", jobId }, { status: 502 });
  }
}
