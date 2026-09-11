import { auth } from "@clerk/nextjs/server";
import { readTikTokPublishRequest } from "@/lib/publish/request";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { readPublishVideoMetadata } from "@/lib/publish/video-metadata";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await readTikTokPublishRequest(req);
    const media = await resolveOwnedMediaKey(userId, body);
    if (!media.ok)
      return Response.json({ error: media.error }, { status: media.status });
    return Response.json(
      await readPublishVideoMetadata(media.mediaKey, req.signal),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return (
      requestBodyErrorResponse(error) ??
      Response.json({ error: "video_preview_unavailable" }, { status: 502 })
    );
  }
}
