import { auth } from "@clerk/nextjs/server";
import { guardProviderIngress } from "@/lib/provider-rate-limit";
import { importInstagramVideo } from "@/lib/publish/server/instagram-import";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limited = await guardProviderIngress(req);
  if (limited) return limited;
  return importInstagramVideo(req, userId);
}
