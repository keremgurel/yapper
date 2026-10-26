import { auth } from "@clerk/nextjs/server";
import { guardProviderIngress } from "@/lib/provider-rate-limit";
import { importTikTokVideo } from "@/lib/publish/server/platform-import";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limited = await guardProviderIngress(req);
  if (limited) return limited;
  return importTikTokVideo(req, userId);
}
