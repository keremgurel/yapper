import { getContentItem } from "@/lib/db/content";
import { listConnections } from "@/lib/db/publish";
import type { PublishPlatform } from "@/lib/db/schema";
import { isPlatformEnabled } from "@/lib/publish/availability";
import { PLATFORMS } from "@/lib/publish/platforms";
import { StudioActionFailure } from "../executor";
import { videoTitle } from "./reads";

/** One of the creator's own videos that Poster can open: a library item with
 * a recorded or uploaded file behind it. */
export async function postableVideo(userId: string, id: string) {
  const item = await getContentItem(userId, id);
  if (!item)
    throw new StudioActionFailure(
      "not_found",
      "I couldn’t find that video. It may have been removed.",
    );
  if (!item.submissionId)
    throw new StudioActionFailure(
      "no_video",
      `“${videoTitle(item.title)}” has no video yet. Record or upload it first.`,
    );
  return { item, title: videoTitle(item.title) };
}

/** The platforms the creator has connected and Yapper can post to now. */
export async function connectedPlatforms(
  userId: string,
): Promise<PublishPlatform[]> {
  return (await listConnections(userId))
    .filter(
      (connection) =>
        connection.status === "active" &&
        isPlatformEnabled(connection.platform),
    )
    .map((connection) => connection.platform);
}

/** Refuse a platform Yapper has paused before anything is filled in. */
export function refusePaused(platforms: readonly PublishPlatform[]): void {
  const paused = platforms.filter((platform) => !isPlatformEnabled(platform));
  if (paused.length)
    throw new StudioActionFailure(
      "platform_paused",
      `Posting to ${platformList(paused)} is paused right now, so I left Poster as it was.`,
    );
}

/** “TikTok”, “TikTok and YouTube”, “TikTok, YouTube and Instagram”. */
export function platformList(platforms: readonly PublishPlatform[]): string {
  const labels = platforms.map((platform) => PLATFORMS[platform].label);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}
