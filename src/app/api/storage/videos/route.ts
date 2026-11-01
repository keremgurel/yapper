import { auth } from "@clerk/nextjs/server";
import { listStoredVideos } from "@/lib/db/storage-videos";
import { refusalResponse } from "@/lib/http/operation-result";
import {
  removeStoredVideo,
  VIDEO_IN_USE,
} from "@/lib/storage/operations/remove-video";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";

export const runtime = "nodejs";

/** Storage management uses the caller's existing native/web session. No browser
 * handoff, public media URL, or client-supplied account identity is involved. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ videos: await listStoredVideos(userId) });
}

export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await readBoundedJson(req, { maxBytes: 4096 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const removed = await removeStoredVideo(
    userId,
    (body as { mediaKey?: unknown } | null)?.mediaKey,
  );
  if (!removed.ok)
    return removed.error === "video_in_use"
      ? Response.json(
          { error: "video_in_use", message: VIDEO_IN_USE },
          { status: 409 },
        )
      : refusalResponse(removed);
  return Response.json({ ok: true });
}
