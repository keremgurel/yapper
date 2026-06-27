import { NextResponse } from "next/server";
import { detectPlatform, youtubeId } from "@/lib/inspiration/platform";
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

  const [meta, transcript] = await Promise.all([
    resolveMetadata(platform, url),
    platform === "youtube"
      ? (async () => {
          const id = youtubeId(url);
          return id ? fetchYoutubeTranscript(id) : null;
        })()
      : Promise.resolve(null),
  ]);

  const resolved: ResolvedLink = {
    platform,
    title: meta.title || fallbackTitle(platform),
    author: meta.author,
    thumbnail: meta.thumbnail,
    transcript: transcript ?? undefined,
  };

  return NextResponse.json(resolved);
}

function fallbackTitle(platform: ResolvedLink["platform"]): string {
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
