import { NextResponse } from "next/server";
import { detectPlatform, extractHandle } from "@/lib/inspiration/platform";
import { scrapeCreator } from "@/lib/inspiration/apify";
import { rankByOutlier } from "@/lib/inspiration/outliers";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_VIDEOS = 24;

/** Scrape a creator's recent feed (via Apify) and return it ranked with outlier
 * flags. Best-effort: on any actor failure we return an empty feed with a note
 * rather than erroring, so saving a creator never hard-fails on scraping. */
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
  const handle = extractHandle(url) ?? undefined;

  try {
    const scrape = await scrapeCreator(platform, url, handle);
    const videos = rankByOutlier(scrape.videos).slice(0, MAX_VIDEOS);
    return NextResponse.json({
      name: scrape.name,
      avatar: scrape.avatar,
      videos,
      scrapedAt: Date.now(),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "scrape_failed";
    // Soft-fail: the creator still saves, just without a feed yet.
    return NextResponse.json({ videos: [], error: detail }, { status: 200 });
  }
}
