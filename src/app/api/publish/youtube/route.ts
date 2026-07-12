import { auth } from "@clerk/nextjs/server";
import {
  completePublishJob,
  createPublishJob,
  failPublishJob,
} from "@/lib/db/publish";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { getOwnedMediaKey } from "@/lib/db/submissions";
import { uploadYouTubeVideo } from "@/lib/publish/youtube";
import { getObjectBytes, ownsKey, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Post a video (already in R2, by mediaKey) to the user's connected YouTube.
 * Records a publish_job either way, so a failure is inspectable rather than lost.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    submissionId?: string;
    mediaKey?: string;
    title?: string;
    description?: string;
    tags?: string[];
    privacyStatus?: "private" | "unlisted" | "public";
    contentItemId?: string;
  };
  const { title } = body;
  if (!title?.trim()) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Prefer a submissionId (resolved to its media key, scoped to the caller);
  // fall back to a raw mediaKey. Either way the key must be the caller's own.
  const mediaKey = body.submissionId
    ? await getOwnedMediaKey(userId, body.submissionId)
    : body.mediaKey;
  if (!mediaKey) {
    return Response.json({ error: "media_not_found" }, { status: 404 });
  }
  if (!ownsKey(userId, mediaKey)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "youtube");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const jobId = await createPublishJob(userId, {
    platform: "youtube",
    mediaKey,
    title,
    contentItemId: body.contentItemId ?? null,
  });

  try {
    const bytes = await getObjectBytes(mediaKey);
    const result = await uploadYouTubeVideo({
      accessToken,
      bytes,
      title,
      description: body.description,
      tags: body.tags,
      privacyStatus: body.privacyStatus ?? "private",
    });
    await completePublishJob(jobId, {
      externalPostId: result.videoId,
      externalUrl: result.url,
    });
    return Response.json({ jobId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload_failed";
    await failPublishJob(jobId, message);
    console.error("[publish] youtube upload failed", message);
    return Response.json({ error: "upload_failed", jobId }, { status: 502 });
  }
}
