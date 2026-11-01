import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { listenToVideo } from "@/lib/brain/operations/voice";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";
import { parseSampleRequest } from "@/lib/voice/sample-input";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Listens to one of the creator's published videos.
 *
 * One video per request, so a long one has the whole budget and the client
 * can show progress per video. Credits are reserved on the reported length
 * and settled on the length actually heard (see listenToVideo).
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSampleRequest(body);
  if (!parsed) return Response.json({ error: "bad_request" }, { status: 400 });

  const result = await listenToVideo(
    req,
    userId,
    parsed.platform,
    parsed.video,
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("voice_samples_added", trackedPOST);
