import { timingSafeEqual } from "node:crypto";
import { releaseLapsedMediaBatch } from "@/lib/db/lapsed-media-retention";
import {
  releasePostedMediaBatch,
  releaseSupersededMediaBatch,
} from "@/lib/db/posted-media-retention";
import { processR2LifecycleBatch } from "@/lib/db/r2-lifecycle";
import { reconcileR2Inventory } from "@/lib/db/r2-reconciliation";
import { cleanupExpiredRateLimitBuckets } from "@/lib/db/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE_BUDGET_MS = 45_000;
// A daily run on the Hobby plan has to clear a day of deletions: it works
// until the time budget, not a fixed count.
const DEFAULT_BATCH_SIZE = 2_000;
const MAX_BATCH_SIZE = 5_000;
const RATE_LIMIT_CLEANUP_BATCH_SIZE = 500;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function batchSize(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw === null ? DEFAULT_BATCH_SIZE : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, parsed));
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const deadlineAt = Date.now() + ROUTE_BUDGET_MS;
  let supersededMedia = { released: 0, failed: 0 };
  try {
    supersededMedia = await releaseSupersededMediaBatch();
  } catch (error) {
    console.error("[maintenance] superseded media release failed", error);
    supersededMedia.failed += 1;
  }

  // Posted videos are let go first, so this same run deletes their files.
  let postedMedia = { released: 0, failed: 0 };
  try {
    postedMedia = await releasePostedMediaBatch();
  } catch (error) {
    console.error("[maintenance] posted media release failed", error);
    postedMedia.failed += 1;
  }

  let lapsedMedia = { accounts: 0, released: 0, failed: 0 };
  try {
    lapsedMedia = await releaseLapsedMediaBatch();
  } catch (error) {
    console.error("[maintenance] lapsed media release failed", error);
    lapsedMedia.failed += 1;
  }

  let inventory = null;
  let inventoryFailed = false;
  try {
    inventory = await reconcileR2Inventory(
      Math.min(deadlineAt, Date.now() + 8_000),
    );
  } catch (error) {
    inventoryFailed = true;
    console.error("[maintenance] R2 inventory reconciliation failed", error);
  }

  const result = await processR2LifecycleBatch({
    limit: batchSize(request),
    deadlineAt,
  });
  let rateLimitBucketsDeleted = 0;
  let rateLimitCleanupFailed = false;
  try {
    rateLimitBucketsDeleted = await cleanupExpiredRateLimitBuckets(
      RATE_LIMIT_CLEANUP_BATCH_SIZE,
    );
  } catch (error) {
    rateLimitCleanupFailed = true;
    console.error("[maintenance] rate-limit cleanup failed", error);
  }
  // Surface partial failure to cron/uptime monitoring instead of reporting a
  // healthy 200 while undeleted media or expired counters keep accumulating.
  const failed =
    supersededMedia.failed > 0 ||
    postedMedia.failed > 0 ||
    lapsedMedia.failed > 0 ||
    result.retried > 0 ||
    inventoryFailed ||
    rateLimitCleanupFailed;
  return Response.json(
    {
      ...result,
      postedMedia,
      supersededMedia,
      lapsedMedia,
      rateLimitBucketsDeleted,
      rateLimitCleanupFailed,
      inventory,
      inventoryFailed,
    },
    {
      status: failed ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
