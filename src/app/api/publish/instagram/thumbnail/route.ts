import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { assertSafeRemoteUrl } from "@/lib/publish/instagram-import";
import { fetchBoundedResponse, fetchBoundedJson } from "@/lib/http/outbound";

export const runtime = "nodejs";

/** Fetch a fresh original cover through Graph, serving canvas-safe image bytes. */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const mediaId = new URL(req.url).searchParams.get("mediaId") ?? "";
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(mediaId)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const token = await getFreshAccessToken(userId, "instagram");
    const { response, data } = await fetchBoundedJson<{
      thumbnail_url?: string;
    }>(
      `https://graph.instagram.com/v21.0/${mediaId}?fields=thumbnail_url`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      { timeoutMs: 10000, maxBytes: 64 * 1024, signal: req.signal },
    );
    if (!response.ok || !data.thumbnail_url)
      throw new Error("thumbnail_unavailable");
    const image = await fetchBoundedResponse(
      assertSafeRemoteUrl(data.thumbnail_url).toString(),
      { redirect: "error", cache: "no-store" },
      { timeoutMs: 15000, maxBytes: 20 * 1024 * 1024, signal: req.signal },
    );
    const type = image.response.headers.get("content-type")?.split(";")[0];
    if (
      !image.response.ok ||
      !type ||
      !["image/jpeg", "image/png", "image/webp"].includes(type)
    ) {
      throw new Error("thumbnail_unavailable");
    }
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "thumbnail_unavailable" },
      { status: error instanceof NoConnectionError ? 409 : 502 },
    );
  }
}
