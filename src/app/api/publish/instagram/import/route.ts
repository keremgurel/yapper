import { auth } from "@clerk/nextjs/server";
import {
  importedMediaForPost,
  recordImportedMedia,
} from "@/lib/db/imported-media";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { fetchInstagramMediaForImport } from "@/lib/publish/instagram-import";
import { resolveInstagramSourceFile } from "@/lib/publish/instagram-source-file";
import { mediaKey, putObjectBytes, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Pull one of the user's own Instagram videos into their R2 storage so the
 * normal publish path can cross-post it elsewhere. Takes a media id, looks up
 * the file URL server-side under the user's token, downloads it, and stores it
 * under the user's prefix. Returns the resulting mediaKey and a suggested title.
 *
 * Reels with licensed audio come back from Graph without a file URL, so the
 * lookup falls back to the permalink; that path is slower, which is why this
 * route runs long.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as { mediaId?: string };
  const mediaId = body.mediaId?.trim();
  if (!mediaId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Already pulled this post back once. The file is in storage, so re-posting
  // it must not pay for the lookup and the transfer a second time.
  const cached = await importedMediaForPost(userId, "instagram", mediaId);
  if (cached) {
    return Response.json({
      mediaKey: cached.mediaKey,
      title: cached.title ?? "",
    });
  }

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "instagram");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ error: "not_connected" }, { status: 409 });
    }
    throw e;
  }

  let media;
  let sourceFileUrl: string;
  try {
    media = await fetchInstagramMediaForImport(accessToken, mediaId);
    sourceFileUrl = await resolveInstagramSourceFile(media);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "not_a_video") {
      return Response.json({ error: "not_a_video" }, { status: 422 });
    }
    if (msg === "no_source_file") {
      return Response.json({ error: "no_source_file" }, { status: 422 });
    }
    console.error("[publish] instagram import lookup failed", e);
    return Response.json({ error: "import_failed" }, { status: 502 });
  }

  const fileRes = await fetch(sourceFileUrl);
  if (!fileRes.ok) {
    return Response.json({ error: "download_failed" }, { status: 502 });
  }
  const bytes = await fileRes.arrayBuffer();
  const key = mediaKey(userId, `ig-${mediaId}`, "mp4");
  await putObjectBytes(key, bytes, "video/mp4");
  await recordImportedMedia(userId, "instagram", mediaId, key, media.title);

  return Response.json({ mediaKey: key, title: media.title });
}
