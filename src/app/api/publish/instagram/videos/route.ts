import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { listInstagramVideos } from "@/lib/publish/instagram-list";

export const runtime = "nodejs";

/** The connected Instagram account's own videos and Reels, for the Poster.
 * Returns `connected: false` rather than erroring when Instagram isn't linked. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "instagram");
  } catch (e) {
    if (e instanceof NoConnectionError) {
      return Response.json({ connected: false, videos: [] });
    }
    throw e;
  }

  try {
    const videos = await listInstagramVideos(accessToken);
    return Response.json({ connected: true, videos });
  } catch (e) {
    console.error("[publish] instagram list failed", e);
    return Response.json(
      { connected: true, videos: [], error: "list_failed" },
      { status: 502 },
    );
  }
}
