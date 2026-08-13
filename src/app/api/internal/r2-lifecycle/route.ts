import { timingSafeEqual } from "node:crypto";
import { processR2LifecycleBatch } from "@/lib/db/r2-lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE_BUDGET_MS = 45_000;
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;

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

  const result = await processR2LifecycleBatch({
    limit: batchSize(request),
    deadlineAt: Date.now() + ROUTE_BUDGET_MS,
  });
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
