import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isVersionFormat } from "@/lib/content/formats";
import { refusalResponse } from "@/lib/http/operation-result";
import { parseExpandIdeaInput } from "@/lib/ideas/expand-input";
import { chargedIdeaExpansion } from "@/lib/ideas/operations/expand";
import { guardProviderIngress } from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_JSON_BYTES = 256 * 1024;

/**
 * Expand a raw idea into a reference-specific creative dossier. The creator's
 * original words and the source transcript are preserved client-side; this only
 * builds the regenerable analysis around them.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  let rawBody: unknown;
  try {
    rawBody = await readBoundedJson(req, { maxBytes: MAX_JSON_BYTES });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const body =
    rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};
  const input = parseExpandIdeaInput(body.input);
  if (!input) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }
  // The idea's lead format. Short-form keeps the drafting prompt it always
  // had; a long-form or article lead is written in its own shape.
  const format = isVersionFormat(body.format) ? body.format : "short";
  const result = await chargedIdeaExpansion(
    req,
    userId,
    input,
    format,
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("idea_expanded", trackedPOST);
