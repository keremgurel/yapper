import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { archivedMediaKeysForPosts } from "@/lib/db/publish";
import { listInstagramVideos } from "@/lib/publish/instagram-list";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

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
      return Response.json(
        { connected: false, videos: [] },
        { headers: NO_STORE_HEADERS },
      );
    }
    throw e;
  }

  try {
    const videos = await listInstagramVideos(accessToken);
    const archived = await archivedMediaKeysForPosts(
      userId,
      "instagram",
      videos.map((video) => video.id),
    );
    return Response.json(
      {
        connected: true,
        videos: videos.map((video) => ({
          ...video,
          mediaKey: archived.get(video.id),
          sourcePlatform: "instagram",
        })),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    console.error("[publish] instagram list failed", e);
    return Response.json(
      { connected: true, videos: [], error: "list_failed" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
