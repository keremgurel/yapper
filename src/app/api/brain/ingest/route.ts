import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { chargedIngestProposal } from "@/lib/brain/operations/ingest";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SAMPLE_MAX = 4_000;
const SHAPE_MAX = 200;

/**
 * Name a paste, so it can be filed.
 *
 * Only the sample reaches this route, never the import. The browser already
 * parsed the whole thing with the same pure code the server would have used,
 * which means a creator can drop a five thousand row export and see it laid out
 * before anything is uploaded, and the naming call costs the same as naming
 * five rows.
 *
 * Nothing is saved here. The proposal goes back to a preview the creator edits,
 * and saving is an ordinary block create.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sample =
    typeof body.sample === "string" ? body.sample.slice(0, SAMPLE_MAX) : "";
  const shape =
    typeof body.shape === "string" ? body.shape.slice(0, SHAPE_MAX) : "";
  if (!sample.trim()) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }

  const result = await chargedIngestProposal(
    req,
    userId,
    { shape, sample },
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("brain_ingested", trackedPOST);
