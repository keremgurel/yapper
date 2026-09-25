import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { archivedMediaKeysForPosts } from "@/lib/db/publish";
import { withServerTiming } from "@/lib/http/server-timing";
import {
  cachedVideoList,
  wantsFreshList,
} from "@/lib/publish/video-list-cache";
import { listYouTubeVideos } from "@/lib/publish/youtube-list";

export const runtime = "nodejs";

/** The connected channel's own uploads (with view counts), for the content
 * hub. Returns `connected: false` rather than erroring when YouTube isn't
 * linked. Served from a short cache; `?fresh=1` skips it. */
export const GET = withServerTiming(async (req: Request): Promise<Response> => {
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
    const videos = await cachedVideoList(
      userId,
      "youtube",
      async () => {
        const listed = await listYouTubeVideos(accessToken);
        const archived = await archivedMediaKeysForPosts(
          userId,
          "youtube",
          listed.map((video) => video.id),
        );
        return listed.map((video) => ({
          ...video,
          mediaKey: archived.get(video.id),
          sourcePlatform: "youtube",
        }));
      },
      { fresh: wantsFreshList(req) },
    );
    return Response.json({ connected: true, videos });
  } catch (e) {
    console.error("[publish] youtube list failed", e);
    return Response.json(
      { connected: true, videos: [], error: "list_failed" },
      { status: 502 },
    );
  }
});
