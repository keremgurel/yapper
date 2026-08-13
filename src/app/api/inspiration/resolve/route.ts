import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getBalance } from "@/lib/db/credits";
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
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

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
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

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
  if (isWebResource && !process.env.SURPLUS_API_KEY) {
    return NextResponse.json({ error: "no_provider" }, { status: 501 });
  }
  if (
    kind === "video" &&
    (platform === "instagram" || platform === "tiktok") &&
    (!process.env.APIFY_TOKEN || !process.env.DEEPGRAM_API_KEY)
  ) {
    return NextResponse.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(
    userId,
    "reference_analysis",
  );
  if (billing) return billing;
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "inspiration-resolve",
  );
  if (spendLimited) return spendLimited;
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
      ? resolveWrittenReference(url, req.signal)
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

    // Charge only for a delivered analysis. A transcript is the deliverable for
    // a video; for a genuine written resource the summary is, which is why an
    // article still costs. Anything else (a video we could not hear, a creator
    // link that is only metadata) refunds.
    //
    // This was the billing bug: the old fallback returned normally instead of
    // throwing, so the catch below never ran and a failed transcription still
    // cost 2 credits.
    const delivered =
      Boolean(sourceDetails.transcript?.trim()) ||
      Boolean(sourceDetails.summary?.trim());
    let { balance } = reservation;
    if (!delivered) {
      await refundCreditReservation(
        userId,
        reservation,
        "no_analysis_delivered",
      );
      balance = await getBalance(userId);
    }

    return NextResponse.json({ ...resolved, balance });
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

/**
 * Resolve a social video: media URL from the scraper, audio from Deepgram.
 *
 * A failure here used to fall through to `resolveWrittenReference`, which
 * returned the post's page text as a summary. That is the silent downgrade: a
 * Reel came back looking like an article, and the expansion prompt was then
 * explicitly told to treat it as "a written resource rather than a video
 * transcript" and not to invent dialogue. The output was visibly worse and
 * nothing said why.
 *
 * Now a video we could not hear stays a video, and reports that it has no
 * transcript. The creator can retry it or attach the media themselves; both
 * beat being handed a quietly degraded answer.
 */
async function resolveSocialVideo(
  url: string,
  media: () => Promise<{
    mediaUrl?: string;
    title?: string;
    thumbnail?: string;
  }>,
  label: string,
): Promise<SourceDetails> {
  try {
    const resolved = await media();
    if (!resolved.mediaUrl) throw new Error("missing_reference_media");
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("no_transcription_provider");
    const transcript = await transcribeRemoteMedia(resolved.mediaUrl, key);
    if (!transcript) throw new Error("empty_reference_transcript");
    return { ...resolved, transcript, referenceType: "social-video" };
  } catch (error) {
    console.warn(
      `[inspiration] ${label} media unavailable; reporting needs_media`,
      error instanceof Error ? error.message : "unknown_error",
    );
    // No summary: handing back page text for a video is what made the old
    // behaviour dishonest. The card still renders from oembed metadata.
    return { transcript: null, referenceType: "social-video" };
  }
}

const resolveInstagramReference = (url: string) =>
  resolveSocialVideo(url, () => resolveInstagramMedia(url), "Instagram");

const resolveTikTokReference = (url: string) =>
  resolveSocialVideo(url, () => resolveTikTokMedia(url), "TikTok");

async function resolveWrittenReference(
  url: string,
  signal?: AbortSignal,
): Promise<SourceDetails> {
  const resource = await resolveWebResource(url, signal);
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
