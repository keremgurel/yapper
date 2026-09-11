import { auth } from "@clerk/nextjs/server";
import { getConnectionRow, archivedMediaKeysForPosts } from "@/lib/db/publish";
import { getFreshAccessToken } from "@/lib/publish/connection";
import { listFacebookVideos } from "@/lib/publish/facebook-list";
export const runtime = "nodejs";
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const row = await getConnectionRow(userId, "facebook");
  if (!row?.externalAccountId)
    return Response.json({ connected: false, videos: [] });
  try {
    const token = await getFreshAccessToken(
      userId,
      "facebook",
      row.externalAccountId,
    );
    const videos = await listFacebookVideos(row.externalAccountId, token);
    const archived = await archivedMediaKeysForPosts(
      userId,
      "facebook",
      videos.map((v) => v.id),
    );
    return Response.json(
      {
        connected: true,
        videos: videos.map((v) => ({
          ...v,
          mediaKey: archived.get(v.id),
          sourcePlatform: "facebook",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "facebook_list_failed" }, { status: 502 });
  }
}
