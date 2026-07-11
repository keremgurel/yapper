import { NextResponse } from "next/server";
import {
  detectKind,
  detectPlatform,
  extractHandle,
  youtubeId,
} from "@/lib/inspiration/platform";
import { resolveMetadata } from "@/lib/inspiration/oembed";
import { fetchYoutubeTranscript } from "@/lib/inspiration/youtube-transcript";
import type { ResolvedLink } from "@/lib/inspiration/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
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

  // Only fetch a transcript for actual videos on YouTube; a profile has none.
  const [meta, transcript] = await Promise.all([
    resolveMetadata(platform, url),
    kind === "video" && platform === "youtube"
      ? (async () => {
          const id = youtubeId(url);
          return id ? fetchYoutubeTranscript(id) : null;
        })()
      : Promise.resolve(null),
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
          title: meta.title || videoFallback(platform),
          author: meta.author,
          thumbnail: meta.thumbnail,
          transcript: transcript ?? undefined,
        };

  return NextResponse.json(resolved);
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
