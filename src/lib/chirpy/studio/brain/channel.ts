import { listConnections } from "@/lib/db/publish";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import { listInstagramVideos } from "@/lib/publish/instagram-list";
import { listTikTokVideos } from "@/lib/publish/tiktok-list";
import { listYouTubeVideos } from "@/lib/publish/youtube-list";
import type { SampleVideoInput } from "@/lib/voice/sample-input";

type ListenPlatform = Extract<
  PublishPlatform,
  "youtube" | "tiktok" | "instagram"
>;

const LISTS: Record<
  ListenPlatform,
  (token: string) => Promise<
    {
      id: string;
      url: string;
      title: string;
      thumbnail: string | null;
      publishedAt: string;
      durationSec: number | null;
    }[]
  >
> = {
  youtube: (token) => listYouTubeVideos(token),
  tiktok: (token) => listTikTokVideos(token),
  instagram: (token) => listInstagramVideos(token),
};

/**
 * The connected channel's own videos, newest first, as the video picker would
 * hand them to the voice set. Null when the platform is not connected.
 * Read straight from the platform rather than the routes' short list cache,
 * which holds a different shape.
 */
export async function channelVideos(
  userId: string,
  platform: ListenPlatform,
): Promise<SampleVideoInput[] | null> {
  const connected = (await listConnections(userId)).some(
    (row) => row.platform === platform && row.status === "active",
  );
  if (!connected) return null;
  let token: string;
  try {
    token = await getFreshAccessToken(userId, platform);
  } catch (error) {
    if (error instanceof NoConnectionError) return null;
    throw error;
  }
  const videos = await LISTS[platform](token);
  return videos
    .map((video) => ({
      id: video.id,
      url: video.url,
      title: video.title,
      thumbnail: video.thumbnail,
      publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
      durationSec: video.durationSec,
    }))
    .sort(
      (a, b) =>
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );
}
