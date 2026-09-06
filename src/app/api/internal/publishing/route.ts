import { timingSafeEqual } from "node:crypto";
import { runDuePublishing } from "@/lib/publish/schedule-runner";
import { schedulingEnabled } from "@/lib/publish/schedule-types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!schedulingEnabled())
    return Response.json({ enabled: false, claimed: 0 });
  return Response.json(await runDuePublishing(request.signal), {
    headers: { "Cache-Control": "no-store" },
  });
}
