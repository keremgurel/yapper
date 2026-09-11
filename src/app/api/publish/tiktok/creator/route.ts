import { auth } from "@clerk/nextjs/server";
import { getConnectionRow } from "@/lib/db/publish";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { fetchTikTokCreator } from "@/lib/publish/tiktok-direct";
import { TikTokPublishError } from "@/lib/publish/tiktok";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const row = await getConnectionRow(userId, "tiktok");
    if (!row?.externalAccountId)
      throw new NoConnectionError("tiktok_not_connected");
    const token = await getFreshAccessToken(
      userId,
      "tiktok",
      row.externalAccountId,
    );
    const creator = await fetchTikTokCreator(token, req.signal);
    return Response.json(
      {
        creator,
        accountId: row.externalAccountId,
        audited: process.env.TIKTOK_DIRECT_POST_AUDITED === "1",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TikTokPublishError
            ? error.message
            : error instanceof NoConnectionError
              ? error.message
              : "tiktok_creator_unavailable",
      },
      { status: 409 },
    );
  }
}
