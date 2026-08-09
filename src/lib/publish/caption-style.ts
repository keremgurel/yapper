import { getFreshAccessToken } from "@/lib/publish/connection";
import { listYouTubeVideos } from "@/lib/publish/youtube-list";
import { listInstagramVideos } from "@/lib/publish/instagram-list";
import type { PublishPlatform } from "@/lib/db/schema";

const PER_PLATFORM = 8;

/**
 * The creator's own recent captions, per platform, as style exemplars.
 *
 * Per platform rather than pooled: the previous version sampled YouTube titles
 * and used them to shape every caption, which taught the model to write
 * Instagram in YouTube's voice. A creator's Reels captions and their Shorts
 * titles are deliberately different registers, and mixing them produces
 * something that reads as neither.
 *
 * Every failure is swallowed on purpose. Style matching is an enhancement, and
 * a disconnected account or a listing hiccup should cost the creator a plain
 * caption rather than an error.
 */
export async function collectStyleSamples(
  userId: string,
  platforms: PublishPlatform[],
): Promise<Partial<Record<PublishPlatform, string[]>>> {
  const entries = await Promise.all(
    platforms.map(async (platform) => {
      try {
        const samples = await samplesFor(userId, platform);
        return {
          platform,
          samples: samples.filter(Boolean).slice(0, PER_PLATFORM),
        };
      } catch {
        return { platform, samples: [] as string[] };
      }
    }),
  );

  const result: Partial<Record<PublishPlatform, string[]>> = {};
  for (const { platform, samples } of entries) {
    if (samples.length) result[platform] = samples;
  }
  return result;
}

async function samplesFor(
  userId: string,
  platform: PublishPlatform,
): Promise<string[]> {
  if (platform === "youtube") {
    const token = await getFreshAccessToken(userId, "youtube");
    const videos = await listYouTubeVideos(token, 15);
    return videos.map((video) => video.title);
  }

  if (platform === "instagram") {
    const token = await getFreshAccessToken(userId, "instagram");
    const videos = await listInstagramVideos(token, 15);
    // Reels carry their caption in the title slot of the listing shape.
    return videos.map((video) => video.title);
  }

  // TikTok publishes through the inbox endpoint and exposes no caption history
  // worth sampling, so its voice comes from the project brain alone.
  return [];
}
