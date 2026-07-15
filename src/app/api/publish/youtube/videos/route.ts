import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { listYouTubeVideos } from "@/lib/publish/youtube-list";

export const runtime = "nodejs";

/** The connected channel's own uploads (with view counts), for the content hub.
 * Returns `connected: false` rather than erroring when YouTube isn't linked. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "youtube");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ connected: false, videos: [] });
    }
    throw e;
  }

  try {
    const videos = await listYouTubeVideos(accessToken);
    return Response.json({ connected: true, videos });
  } catch (e) {
    console.error("[publish] youtube list failed", e);
    return Response.json(
      { connected: true, videos: [], error: "list_failed" },
      { status: 502 },
    );
  }
}
