import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
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
  const access = await reservePaidActionOrResponse(
    userId,
    "reference_analysis",
  );
  if (access.response) return access.response;
  const { reservation } = access;

  try {
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

    return NextResponse.json({ ...resolved, balance: reservation.balance });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "resolve_failed";
    await refundCreditReservation(userId, reservation, detail);
    return NextResponse.json(
      { error: "resolve_failed", detail },
      { status: 502 },
    );
  }
}

async function resolveYouTubeReference(url: string): Promise<SourceDetails> {
  const id = youtubeId(url);
  const transcript = id ? await fetchYoutubeTranscript(id) : null;
  if (!transcript) throw new Error("empty_reference_transcript");
  return { transcript, referenceType: "social-video" };
}

async function resolveInstagramReference(url: string): Promise<SourceDetails> {
  try {
    const media = await resolveInstagramMedia(url);
    if (!media.mediaUrl) throw new Error("missing_reference_media");
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("no_transcription_provider");
    const transcript = await transcribeRemoteMedia(media.mediaUrl, key);
    if (!transcript) throw new Error("empty_reference_transcript");
    return { ...media, transcript, referenceType: "social-video" };
  } catch (error) {
    // Instagram's CDN media URL normally comes from Apify, but a depleted or
    // unavailable scraper must not discard the reference entirely. Reader can
    // still recover the post's real caption, author, engagement context, and
    // visible page text. Store a faithful summary of that evidence and clearly
    // leave transcript empty instead of generating from the creator note alone.
    console.warn(
      "[inspiration] Instagram media unavailable; using page summary",
      error instanceof Error ? error.message : "unknown_error",
    );
    return resolveWrittenReference(url);
  }
}

async function resolveTikTokReference(url: string): Promise<SourceDetails> {
  try {
    const media = await resolveTikTokMedia(url);
    if (!media.mediaUrl) throw new Error("missing_reference_media");
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("no_transcription_provider");
    const transcript = await transcribeRemoteMedia(media.mediaUrl, key);
    if (!transcript) throw new Error("empty_reference_transcript");
    return { ...media, transcript, referenceType: "social-video" };
  } catch (error) {
    console.warn(
      "[inspiration] TikTok media unavailable; using page summary",
      error instanceof Error ? error.message : "unknown_error",
    );
    return resolveWrittenReference(url);
  }
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
