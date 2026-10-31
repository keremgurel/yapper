import { withProductAnalytics } from "@/lib/analytics/server";
import { after } from "next/server";
import { repairPostedRecordings } from "@/lib/content/recording-memory";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { listContentItems } from "@/lib/db/content";
import { refusalResponse } from "@/lib/http/operation-result";
import { withServerTiming } from "@/lib/http/server-timing";
import { captureIdea } from "@/lib/ideas/operations/capture";

export const runtime = "nodejs";

/** Every idea, whatever its status: there is one list. */
export const GET = withServerTiming(async (): Promise<Response> => {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const items = await listContentItems(userId);
  after(() => repairPostedRecordings(userId));
  return Response.json({ items });
});

/**
 * Capture an idea. Deliberately cheap and synchronous: it stores the creator's
 * exact words immediately and returns, so nothing is ever lost while the
 * (slower, fallible) reference resolution and AI expansion run afterwards.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const captured = await captureIdea(userId, body);
  if (!captured.ok) return refusalResponse(captured);
  return Response.json({ item: captured.value });
}

export const POST = withProductAnalytics("idea_created", trackedPOST);
