import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isVersionFormat } from "@/lib/content/formats";
import { refusalResponse } from "@/lib/http/operation-result";
import { writeIdeaVersion } from "@/lib/ideas/operations/write-version";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string; format: string }> };

/**
 * Write one version of an idea from another of its versions (the lead unless
 * the body names a different one) and save it. Billed like drafting an idea,
 * and refunded when the writing fails, so a failed attempt costs nothing.
 */
async function trackedPOST(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const { id, format } = await params;
  if (!isVersionFormat(format)) {
    return Response.json({ error: "bad_format" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await writeIdeaVersion(
    req,
    userId,
    id,
    format,
    body.from,
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("idea_version_written", trackedPOST);
