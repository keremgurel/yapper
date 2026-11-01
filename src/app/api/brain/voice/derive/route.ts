import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { deriveVoiceProfile } from "@/lib/brain/operations/voice";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Rewrites the voice profile and scripting patterns from the current sample
 * set (see deriveVoiceProfile). Free: the credits were spent listening.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const result = await deriveVoiceProfile(req, userId, req.signal);
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("voice_profile_derived", trackedPOST);
