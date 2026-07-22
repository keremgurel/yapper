import { auth } from "@clerk/nextjs/server";
import {
  completePublishJob,
  createPublishJob,
  failPublishJob,
  getConnectionRow,
} from "@/lib/db/publish";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { postInstagramReel } from "@/lib/publish/instagram";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
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
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    submissionId?: string;
    mediaKey?: string;
    caption?: string;
    contentItemId?: string;
    thumbnailKey?: string;
  };

  const media = await resolveOwnedMediaKey(userId, body);
  if (!media.ok) {
    return Response.json({ error: media.error }, { status: media.status });
  }

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

  const jobId = await createPublishJob(userId, {
    platform: "instagram",
    mediaKey: media.mediaKey,
    caption: body.caption ?? null,
    contentItemId: body.contentItemId ?? null,
  });

  try {
    const videoUrl = await presignView(media.mediaKey, 3600);
    // A custom cover, if the client uploaded one under the user's own prefix.
    const coverUrl =
      body.thumbnailKey && ownsKey(userId, body.thumbnailKey)
        ? await presignView(body.thumbnailKey, 3600)
        : undefined;
    const result = await postInstagramReel({
      accessToken,
      igUserId,
      videoUrl,
      caption: body.caption,
      coverUrl,
    });
    await completePublishJob(jobId, {
      externalPostId: result.mediaId,
      externalUrl: result.url,
    });
    return Response.json({ jobId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "publish_failed";
    await failPublishJob(jobId, message);
    console.error("[publish] instagram publish failed", message);
    const professional = message.includes("instagram_container_");
    return Response.json(
      {
        error: professional ? "not_professional" : "publish_failed",
        jobId,
      },
      { status: 502 },
    );
  }
}
