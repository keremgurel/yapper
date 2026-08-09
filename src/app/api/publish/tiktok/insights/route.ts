import { auth } from "@clerk/nextjs/server";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { fetchTikTokInsights } from "@/lib/publish/tiktok-insights";

export const runtime = "nodejs";

/**
 * The connected creator's TikTok profile and counts.
 *
 * A connection made before the insight scopes were requested still answers,
 * with the counts absent and `missing` naming the scope that would fill them,
 * so the panel can offer a reconnect rather than showing zeros.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, "tiktok");
  } catch (error) {
    if (error instanceof NoConnectionError) {
      return Response.json({ connected: false, insights: null });
    }
    throw error;
  }

  try {
    return Response.json({
      connected: true,
      insights: await fetchTikTokInsights(accessToken),
    });
  } catch (error) {
    console.error("[tiktok/insights] failed", error);
    return Response.json({ error: "insights_failed" }, { status: 502 });
  }
}
