import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { releasePostedMedia } from "@/lib/db/posted-media-retention";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";
import { r2Objects } from "@/lib/db/schema";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

export const VIDEO_IN_USE =
  "This video is still needed for a scheduled post, publishing retry or recent upload. Cancel its schedule or try again after processing finishes.";

/** Delete one of the creator's stored recordings or imports. Ideas, scripts,
 * transcripts and feedback stay; a video a schedule or a publish still needs
 * is refused. */
export async function removeStoredVideo(
  userId: string,
  mediaKey: unknown,
): Promise<OperationResult<null>> {
  if (typeof mediaKey !== "string" || !mediaKey || mediaKey.length > 1024)
    return refused(400, "bad_request");
  const [owned] = await getDb()
    .select({ key: r2Objects.mediaKey })
    .from(r2Objects)
    .where(
      and(
        eq(r2Objects.userId, userId),
        eq(r2Objects.mediaKey, mediaKey),
        eq(r2Objects.state, "active"),
        inArray(r2Objects.purpose, ["recording", "import"]),
      ),
    )
    .limit(1);
  if (!owned) return refused(404, "not_found");
  const result = await releasePostedMedia(
    { userId, mediaKey },
    "user_requested",
  );
  if (result !== "released") return refused(409, "video_in_use");
  drainR2AfterResponse();
  return succeeded(null);
}
