import { auth } from "@clerk/nextjs/server";
import { getConnectionRow, archivedMediaKeysForPosts } from "@/lib/db/publish";
import { withServerTiming } from "@/lib/http/server-timing";
import { getFreshAccessToken } from "@/lib/publish/connection";
import { listFacebookVideos } from "@/lib/publish/facebook-list";
import {
  cachedVideoList,
  wantsFreshList,
} from "@/lib/publish/video-list-cache";
export const runtime = "nodejs";
export const GET = withServerTiming(async (req: Request) => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const row = await getConnectionRow(userId, "facebook");
  if (!row?.externalAccountId)
    return Response.json({ connected: false, videos: [] });
  const pageId = row.externalAccountId;
  try {
    const token = await getFreshAccessToken(userId, "facebook", pageId);
    const videos = await cachedVideoList(
      userId,
      "facebook",
      async () => {
        const listed = await listFacebookVideos(pageId, token);
        const archived = await archivedMediaKeysForPosts(
          userId,
          "facebook",
          listed.map((v) => v.id),
        );
        return listed.map((v) => ({
          ...v,
          mediaKey: archived.get(v.id),
          sourcePlatform: "facebook",
        }));
      },
      { fresh: wantsFreshList(req) },
    );
    return Response.json(
      { connected: true, videos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "facebook_list_failed" }, { status: 502 });
  }
});
