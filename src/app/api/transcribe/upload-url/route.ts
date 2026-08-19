import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { presignUpload, r2Configured, transcriptionKey } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * An hour of speech at the bitrate the transcriber needs, with room to spare.
 * Bound into the signature, so the URL cannot be used to store something else.
 */
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;
/** Long enough to upload a large take on a slow connection, short enough that
 * a leaked URL is worth little. */
const UPLOAD_WINDOW_SECONDS = 900;

/**
 * A one-object write ticket so the editor can put a take's audio straight into
 * storage, and the transcriber can be handed a link to it.
 *
 * The ticket is the narrowest thing that does the job: one key, one method, one
 * byte count, expiring. It is not a provider credential, so holding it does not
 * let anyone transcribe anything — that still costs a credit at the route that
 * actually calls the transcriber.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;
  if (!r2Configured())
    return Response.json({ error: "no_storage" }, { status: 501 });

  let body: unknown;
  try {
    body = await readBoundedJson(req, { maxBytes: 4 * 1024 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const bytes = (body as { bytes?: unknown } | null)?.bytes;
  if (
    typeof bytes !== "number" ||
    !Number.isInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_AUDIO_BYTES
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Handing out write tickets is cheap but not free: it is the one place a
  // signed-in account can put bytes in the bucket, so it answers to the same
  // limiter as the work it leads to.
  const spendLimited = await guardProviderSpend(req, userId, "transcribe");
  if (spendLimited) return spendLimited;

  const key = transcriptionKey(userId, randomUUID());
  const url = await presignUpload(
    key,
    "audio/mp4",
    bytes,
    UPLOAD_WINDOW_SECONDS,
  );
  return Response.json({ key, url });
}
