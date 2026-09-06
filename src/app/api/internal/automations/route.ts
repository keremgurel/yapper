import { timingSafeEqual } from "node:crypto";
import { runAutomations } from "@/lib/publish/automation-runner";
import { automationsEnabled } from "@/lib/publish/automation-types";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!automationsEnabled())
    return Response.json({ available: false, checked: 0 });
  return Response.json(await runAutomations(request.signal), {
    headers: { "Cache-Control": "no-store" },
  });
}
