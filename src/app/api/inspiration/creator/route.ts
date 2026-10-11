import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { detectPlatform, extractHandle } from "@/lib/inspiration/platform";
import {
  CREATOR_FEED_LIMIT,
  fetchCreatorFeed,
} from "@/lib/inspiration/creator-feed";
import { rankByOutlier } from "@/lib/inspiration/outliers";
import { scrapeCacheKey } from "@/lib/inspiration/scrape-cache-key";
import type { CreatorScrape } from "@/lib/inspiration/apify";
import { readScrapeCache, writeScrapeCache } from "@/lib/db/scrape-cache";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A creator's feed is shared across users for this long. Twelve hours keeps
 * view counts honest while a popular creator costs one scrape, not one per
 * user. */
const FEED_CACHE_MS = 12 * 60 * 60 * 1000;

/** Fetch a creator's recent feed and return it ranked with outlier flags.
 * Best-effort: on any failure we return an empty feed with a note rather than
 * erroring, so saving a creator never hard-fails on the feed being unavailable.
 * Which source serves the feed is `fetchCreatorFeed`'s business, not this
 * route's. */
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
  const handle = extractHandle(url) ?? undefined;
  if (platform === "unknown") {
    return NextResponse.json(
      { videos: [], error: "unsupported_platform" },
      { status: 200 },
    );
  }
  if (platform !== "youtube" && !process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { videos: [], error: "no_apify_token" },
      { status: 200 },
    );
  }
  const billing = await preflightPaidActionOrResponse(
    userId,
    "creator_analysis",
  );
  if (billing) return billing;
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "inspiration-creator",
  );
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "creator_analysis");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const cacheKey = scrapeCacheKey("creator", url);
    const cached = await readScrapeCache<CreatorScrape>(
      cacheKey,
      FEED_CACHE_MS,
    );
    const scrape =
      cached ?? (await fetchCreatorFeed(userId, platform, url, handle));
    if (!cached && scrape.videos.length > 0) {
      await writeScrapeCache(cacheKey, scrape);
    }
    const videos = rankByOutlier(scrape.videos).slice(0, CREATOR_FEED_LIMIT);
    return NextResponse.json({
      name: scrape.name,
      avatar: scrape.avatar,
      videos,
      scrapedAt: Date.now(),
      balance: reservation.balance,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "scrape_failed";
    await refundCreditReservation(userId, reservation, detail);
    // Soft-fail: the creator still saves, just without a feed yet.
    return NextResponse.json({ videos: [], error: detail }, { status: 200 });
  }
}
