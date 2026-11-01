import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { isVersionFormat } from "@/lib/content/formats";
import { askIdeaCanvas } from "@/lib/content/operations/canvas-ask";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One ask on an idea's canvas: "write the script", "give me five hooks", "add
 * a section on objections", "make block 2 punchier". The server reads the
 * document, applies and saves the reply, and writes the exchange to the
 * idea's thread (see askIdeaCanvas); the client flushes its own edits first
 * and applies the same actions to what it shows. Document fields older
 * clients still send are ignored.
 */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const instruction =
    typeof body.instruction === "string" ? body.instruction : "";
  const contentId =
    typeof body.contentId === "string" &&
    /^[0-9a-f-]{36}$/i.test(body.contentId)
      ? body.contentId
      : null;
  if (!instruction.trim() || !contentId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const answer = await askIdeaCanvas(
    req,
    userId,
    {
      ideaID: contentId,
      instruction,
      format: isVersionFormat(body.format) ? body.format : undefined,
      target: Number.isInteger(body.target) ? (body.target as number) : null,
    },
    req.signal,
  );
  if (!answer.ok) return refusalResponse(answer);
  return Response.json(answer.value);
}

export const POST = withProductAnalytics("canvas_generated", trackedPOST);
