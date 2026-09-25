import { auth } from "@clerk/nextjs/server";
import { archivedMediaKeysForPosts } from "@/lib/db/publish";
import { withServerTiming } from "@/lib/http/server-timing";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { listTikTokVideos } from "@/lib/publish/tiktok-list";
import {
  cachedVideoList,
  wantsFreshList,
} from "@/lib/publish/video-list-cache";

export const runtime = "nodejs";

/** The connected creator's public TikTok posts. Existing connections made
 * before video.list was added may need a one-time reconnect for this view.
 * Served from a short cache; `?fresh=1` skips it. */
export const GET = withServerTiming(async (req: Request): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "tiktok");
  } catch (error) {
    if (error instanceof NoConnectionError) {
      return Response.json({ connected: false, videos: [] });
    }
    throw error;
  }

  try {
    const videos = await cachedVideoList(
      userId,
      "tiktok",
      async () => {
        const listed = await listTikTokVideos(accessToken);
        const archived = await archivedMediaKeysForPosts(
          userId,
          "tiktok",
          listed.map((video) => video.id),
        );
        return listed.map((video) => ({
          ...video,
          mediaKey: archived.get(video.id),
          sourcePlatform: "tiktok",
        }));
      },
      { fresh: wantsFreshList(req) },
    );
    return Response.json({ connected: true, videos });
  } catch (error) {
    console.error("[publish] tiktok list failed", error);
    return Response.json({
      connected: true,
      videos: [],
      error: "list_failed_or_reconnect_required",
    });
  }
});
