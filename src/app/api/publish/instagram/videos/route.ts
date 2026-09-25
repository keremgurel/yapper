import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { archivedMediaKeysForPosts } from "@/lib/db/publish";
import { withServerTiming } from "@/lib/http/server-timing";
import { listInstagramVideos } from "@/lib/publish/instagram-list";
import {
  cachedVideoList,
  wantsFreshList,
} from "@/lib/publish/video-list-cache";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

/** The connected Instagram account's own videos and Reels, for the Poster.
 * Returns `connected: false` rather than erroring when Instagram isn't linked.
 * Served from a short server cache (one Graph call plus one insights call per
 * video otherwise); `?fresh=1` skips it. */
export const GET = withServerTiming(async (req: Request): Promise<Response> => {
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
    const videos = await cachedVideoList(
      userId,
      "instagram",
      async () => {
        const listed = await listInstagramVideos(accessToken);
        // A Yapper-originated object is already covered by submission
        // lifecycle checks. Imported objects always pass through the import
        // endpoint, even when cached, so HeadObject can detect external/bucket
        // drift and repair stale references before Poster trusts the key.
        const archived = await archivedMediaKeysForPosts(
          userId,
          "instagram",
          listed.map((video) => video.id),
        );
        return listed.map((video) => ({
          ...video,
          mediaKey: archived.get(video.id),
          sourcePlatform: "instagram",
        }));
      },
      { fresh: wantsFreshList(req) },
    );
    return Response.json(
      { connected: true, videos },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    console.error("[publish] instagram list failed", e);
    return Response.json(
      { connected: true, videos: [], error: "list_failed" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
});
