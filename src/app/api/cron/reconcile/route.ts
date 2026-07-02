import type { NextRequest } from "next/server";
import { reconcileStuckSubmissions } from "@/lib/feedback/reconcile";

export const runtime = "nodejs";

// Vercel Cron hits this on a schedule (see vercel.json). Vercel automatically
// sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; we reject
// anything else so the endpoint isn't publicly triggerable.
export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const reconciled = await reconcileStuckSubmissions();
  return Response.json({ reconciled });
}
