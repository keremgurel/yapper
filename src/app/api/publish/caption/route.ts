import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { PublishPlatform } from "@/lib/db/schema";
import { refusalResponse } from "@/lib/http/operation-result";
import { enabledPublishPlatforms } from "@/lib/publish/availability";
import { chargedCaptions } from "@/lib/publish/operations/captions";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;

function platformsOf(value: unknown): PublishPlatform[] {
  if (!Array.isArray(value)) return ["youtube"];
  const wanted = value.filter((v): v is PublishPlatform =>
    (enabledPublishPlatforms as readonly string[]).includes(v as string),
  );
  return wanted.length ? [...new Set(wanted)] : ["youtube"];
}

/** Draft one caption per platform being posted to (see chargedCaptions). */
async function trackedPOST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = str(body.title, 300);
  if (!title) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const titleOnly = body.titleOnly === true;
  const platforms = titleOnly
    ? ["youtube" as const]
    : platformsOf(body.platforms);
  if (body.requireTranscript === true && !str(body.transcript, 24000)) {
    return Response.json({ error: "transcript_required" }, { status: 422 });
  }
  const result = await chargedCaptions(
    req,
    userId,
    {
      title,
      platforms,
      titleOnly,
      contentItemId: str(body.contentItemId, 100),
      transcript: str(body.transcript, 24000),
      videoDescription: str(body.videoDescription, 2000),
      captionReference: str(body.captionReference, 6000),
      context: str(body.context, 2000),
      instructions: str(body.instructions, 2000),
      sourceCaption: str(body.sourceCaption, 5000),
      matchStyle: Boolean(body.matchStyle),
    },
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("caption_generated", trackedPOST);
