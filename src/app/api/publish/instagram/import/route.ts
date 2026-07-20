import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { fetchInstagramMediaForImport } from "@/lib/publish/instagram-import";
import { mediaKey, putObjectBytes, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Pull one of the user's own Instagram videos into their R2 storage so the
 * normal publish path can cross-post it elsewhere. Takes a media id, looks up
 * the file URL server-side under the user's token, downloads it, and stores it
 * under the user's prefix. Returns the resulting mediaKey and a suggested title.
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
  try {
    media = await fetchInstagramMediaForImport(accessToken, mediaId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "not_a_video") {
      return Response.json({ error: "not_a_video" }, { status: 422 });
    }
    console.error("[publish] instagram import lookup failed", e);
    return Response.json({ error: "import_failed" }, { status: 502 });
  }

  const fileRes = await fetch(media.mediaUrl);
  if (!fileRes.ok) {
    return Response.json({ error: "download_failed" }, { status: 502 });
  }
  const bytes = await fileRes.arrayBuffer();
  const key = mediaKey(userId, `ig-${mediaId}`, "mp4");
  await putObjectBytes(key, bytes, "video/mp4");

  return Response.json({ mediaKey: key, title: media.title });
}
