import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { chargedSetupProposal } from "@/lib/brain/operations/setup";
import { SETUP_DOCUMENT_MAX } from "@/lib/brain/setup";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Read one document and propose the whole Brain from it.
 *
 * Nothing is saved here. The proposal goes back to a preview the creator
 * edits field by field, and applying is the ordinary project patch and block
 * creates.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const document =
    typeof body.document === "string"
      ? body.document.slice(0, SETUP_DOCUMENT_MAX)
      : "";
  if (document.trim().length < 40) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }

  const result = await chargedSetupProposal(req, userId, document, req.signal);
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("brain_setup", trackedPOST);
