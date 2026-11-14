import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { parseCanvasBlocks } from "@/lib/content/canvas-request";
import { isVersionFormat } from "@/lib/content/formats";
import {
  askCanvasAsSent,
  askIdeaCanvas,
} from "@/lib/content/operations/canvas-ask";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const strArr = (value: unknown, max: number, cap: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .slice(0, cap)
        .map((x) => x.slice(0, max))
    : [];

/**
 * One ask on an idea's canvas: "write the script", "give me five hooks", "add
 * a section on objections", "make block 2 punchier". A client that sends
 * `serverSaves: true` has saved its edits first; the server reads the
 * document, applies and saves the reply (see askIdeaCanvas). Builds that
 * predate it apply the reply themselves, so for them the writer sees the
 * piece they sent and nothing but the thread is written, as before.
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
  const ask = {
    ideaID: contentId,
    instruction,
    format: isVersionFormat(body.format) ? body.format : undefined,
    target: Number.isInteger(body.target) ? (body.target as number) : null,
  };

  const answer =
    body.serverSaves === true
      ? await askIdeaCanvas(req, userId, ask, req.signal)
      : await askCanvasAsSent(
          req,
          userId,
          {
            ...ask,
            // Bounded on the way in: the body is client supplied, so it is
            // also the biggest lever on token cost here.
            piece: {
              title: str(body.title, 300),
              blocks: parseCanvasBlocks(body.blocks),
              hooks: strArr(body.hooks, 300, 8),
            },
          },
          req.signal,
        );
  if (!answer.ok) return refusalResponse(answer);
  return Response.json(answer.value);
}

export const POST = withProductAnalytics("canvas_generated", trackedPOST);
