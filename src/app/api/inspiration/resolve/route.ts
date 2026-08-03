import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  detectKind,
  detectPlatform,
  extractHandle,
  youtubeId,
} from "@/lib/inspiration/platform";
import { resolveMetadata } from "@/lib/inspiration/oembed";
import {
  resolveInstagramMedia,
  resolveTikTokMedia,
} from "@/lib/inspiration/apify";
import { transcribeRemoteMedia } from "@/lib/inspiration/remote-transcript";
import { resolveWebResource } from "@/lib/inspiration/web-resource";
import { fetchYoutubeTranscript } from "@/lib/inspiration/youtube-transcript";
import type {
  ReferenceContentType,
  ResolvedLink,
} from "@/lib/inspiration/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SourceDetails {
  title?: string;
  thumbnail?: string;
  transcript: string | null;
  summary?: string;
  referenceType?: ReferenceContentType;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let url: string;
  try {
    const body = (await req.json()) as { url?: string };
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "Enter a valid URL" }, { status: 400 });
  }

  const platform = detectPlatform(url);
  const kind = detectKind(url);
  const handle = extractHandle(url) ?? undefined;
  const isWebResource = platform === "unknown";

  // Card metadata and source analysis are independent, so start both together.
  // Instagram needs a direct media URL before Deepgram can hear the Reel.
  const sourceDetailsPromise: Promise<SourceDetails> = isWebResource
    ? resolveWrittenReference(url)
    : kind === "video" && platform === "youtube"
      ? resolveYouTubeReference(url)
      : kind === "video" && platform === "instagram"
        ? resolveInstagramReference(url)
        : kind === "video" && platform === "tiktok"
          ? resolveTikTokReference(url)
          : Promise.resolve({ transcript: null });
  const metadataPromise: Promise<Partial<ResolvedLink>> = isWebResource
    ? Promise.resolve({})
    : resolveMetadata(platform, url);
  const [meta, sourceDetails] = await Promise.all([
    metadataPromise,
    sourceDetailsPromise,
  ]);

  const handleLabel = handle ? `@${handle}` : undefined;

  const resolved: ResolvedLink =
    kind === "creator"
      ? {
          kind,
          platform,
          title: meta.title || handleLabel || creatorFallback(platform),
          author: handleLabel,
          handle,
          thumbnail: meta.thumbnail,
        }
      : {
          kind,
          platform,
          title: sourceDetails.title || meta.title || videoFallback(platform),
          author: meta.author,
          thumbnail: sourceDetails.thumbnail || meta.thumbnail,
          transcript: sourceDetails.transcript ?? undefined,
          summary: sourceDetails.summary,
          referenceType: sourceDetails.referenceType,
        };

  return NextResponse.json(resolved);
}

async function resolveYouTubeReference(url: string): Promise<SourceDetails> {
  const id = youtubeId(url);
  const transcript = id ? await fetchYoutubeTranscript(id) : null;
  if (!transcript) throw new Error("empty_reference_transcript");
  return { transcript, referenceType: "social-video" };
}

async function resolveInstagramReference(url: string): Promise<SourceDetails> {
  const media = await resolveInstagramMedia(url);
  if (!media.mediaUrl) {
    // A still-image post has nothing to transcribe, but is still a valid
    // inspiration reference.
    return { ...media, transcript: null, referenceType: "web-resource" };
  }
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("no_transcription_provider");
  const transcript = await transcribeRemoteMedia(media.mediaUrl, key);
  if (!transcript) throw new Error("empty_reference_transcript");
  return { ...media, transcript, referenceType: "social-video" };
}

async function resolveTikTokReference(url: string): Promise<SourceDetails> {
  const media = await resolveTikTokMedia(url);
  if (!media.mediaUrl) throw new Error("missing_reference_media");
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("no_transcription_provider");
  const transcript = await transcribeRemoteMedia(media.mediaUrl, key);
  if (!transcript) throw new Error("empty_reference_transcript");
  return { ...media, transcript, referenceType: "social-video" };
}

async function resolveWrittenReference(url: string): Promise<SourceDetails> {
  const resource = await resolveWebResource(url);
  return { ...resource, transcript: null };
}

function videoFallback(platform: ResolvedLink["platform"]): string {
  switch (platform) {
    case "youtube":
      return "YouTube video";
    case "tiktok":
      return "TikTok video";
    case "instagram":
      return "Instagram post";
    default:
      return "Saved link";
  }
}

function creatorFallback(platform: ResolvedLink["platform"]): string {
  switch (platform) {
    case "youtube":
      return "YouTube channel";
    case "tiktok":
      return "TikTok creator";
    case "instagram":
      return "Instagram creator";
    default:
      return "Creator";
  }
}
