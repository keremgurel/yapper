import type { PublishPlatform } from "@/lib/db/schema";
import {
  resolveInstagramMedia,
  resolveTikTokMedia,
} from "@/lib/inspiration/apify";
import { fetchTikTokSubtitles } from "@/lib/inspiration/tiktok-subtitles";
import { fetchYoutubeTranscript } from "@/lib/inspiration/youtube-transcript";
import { getFreshAccessToken } from "@/lib/publish/connection";

const GRAPH = "https://graph.instagram.com/v21.0";

export interface SampleVideoRef {
  id: string;
  url: string;
}

export type SampleSource =
  | { kind: "media"; mediaUrl: string }
  | { kind: "transcript"; transcript: string };

async function instagramMediaUrl(
  userId: string,
  mediaId: string,
): Promise<string | null> {
  try {
    const token = await getFreshAccessToken(userId, "instagram");
    const res = await fetch(
      `${GRAPH}/${mediaId}?fields=media_url&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { media_url?: unknown };
    return typeof json.media_url === "string" ? json.media_url : null;
  } catch {
    return null;
  }
}

/**
 * Where the words of one of the creator's videos come from.
 *
 * YouTube publishes captions, so those are read as they are. Instagram hands
 * back the file through Graph, or through a scrape when licensed audio makes
 * Graph withhold it. TikTok's API has no file, so the post is scraped and its
 * own captions read; only a video without captions needs a transcription.
 */
export async function resolveSampleSource(
  userId: string,
  platform: PublishPlatform,
  video: SampleVideoRef,
  signal?: AbortSignal,
): Promise<SampleSource> {
  if (platform === "youtube") {
    const transcript = await fetchYoutubeTranscript(video.id);
    if (!transcript?.trim()) throw new Error("no_captions");
    return { kind: "transcript", transcript: transcript.trim() };
  }
  if (platform === "instagram") {
    const direct = await instagramMediaUrl(userId, video.id);
    if (direct) return { kind: "media", mediaUrl: direct };
    if (!video.url) throw new Error("no_source_file");
    const scraped = signal
      ? await resolveInstagramMedia(video.url, signal)
      : await resolveInstagramMedia(video.url);
    if (!scraped.mediaUrl) throw new Error("no_source_file");
    return { kind: "media", mediaUrl: scraped.mediaUrl };
  }
  if (!video.url) throw new Error("no_source_file");
  const media = await resolveTikTokMedia(video.url);
  // TikTok publishes captions for most talking videos; reading them is free.
  const captions = media.subtitleUrl
    ? await fetchTikTokSubtitles(media.subtitleUrl, signal)
    : null;
  if (captions) return { kind: "transcript", transcript: captions };
  if (!media.mediaUrl) throw new Error("no_source_file");
  return { kind: "media", mediaUrl: media.mediaUrl };
}
