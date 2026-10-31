import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { record, UUID } from "@/lib/chirpy/protocol";
import { resolveConfirmation } from "@/lib/chirpy/studio/confirm";
import { isTimeZone } from "@/lib/chirpy/studio/zoned-time";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The creator's answer to a Chirpy confirmation: run the turn's waiting
 * actions, or drop them. No model call and no credit; each action runs once
 * however many times this is sent.
 */
async function trackedPOST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await readBoundedJson(req, { maxBytes: 4 * 1024 });
    if (
      !record(body) ||
      typeof body.executionID !== "string" ||
      !UUID.test(body.executionID) ||
      (body.decision !== "confirm" && body.decision !== "cancel") ||
      !isTimeZone(body.timeZone)
    )
      return Response.json({ error: "bad_request" }, { status: 400 });
    const reply = await resolveConfirmation(
      { userId, request: req, signal: req.signal, timeZone: body.timeZone },
      body.executionID.toLowerCase(),
      body.decision,
    );
    if (!reply) return Response.json({ error: "expired" }, { status: 410 });
    return Response.json(reply);
  } catch (error) {
    const bounded = requestBodyErrorResponse(error);
    if (bounded) return bounded;
    console.error(
      "[chirpy/confirm] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ error: "confirm_failed" }, { status: 500 });
  }
}

export const POST = withProductAnalytics(
  "chirpy_studio_confirmed",
  trackedPOST,
);
