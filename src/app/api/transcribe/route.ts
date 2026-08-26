import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { isAudioTruncated } from "@/lib/studio/transcribe-guard";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedBody,
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { OutboundHttpError } from "@/lib/http/outbound";
import {
  discardTranscriptionAudio,
  isTranscriptionKey,
  presignView,
  r2Configured,
} from "@/lib/r2";
import {
  type AsrResult,
  viaDeepgram,
  viaDeepgramURL,
  viaOpenAiCompatible,
} from "@/lib/transcription/providers";
import { getObjectBytes } from "@/lib/r2";
import { getOwnedMediaKey } from "@/lib/db/submissions";

export const runtime = "nodejs";
export const maxDuration = 120;

// Core product vocabulary should be correct on a brand-new install, before a
// creator has had a chance to build their personal transcription dictionary.
const DEFAULT_KEYTERMS = ["CELPIP", "Yapper"];
const MAX_AUDIO_BYTES = 4_000_000;
const MAX_AUDIO_DURATION_SECONDS = 600;
const PROVIDER_DEADLINE_MS = 108_000;
const AUDIO_MEDIA_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
] as const;

/**
 * Backend transcription, returning word-level timings. Runs an ordered failover
 * chain: Deepgram (nova-3) is the transcriber of record; Groq (whisper-large-v3)
 * is the backup, invoked only if Deepgram actually errors at runtime. Both
 * return per-word timings, so either result drives the editor unchanged.
 * Responds 501 when no provider key is configured.
 */
export async function POST(req: Request): Promise<Response> {
  // Includes auth, bounded ingress read, rate limits, and billing. Provider
  // work receives only what remains of the route's single wall-clock budget.
  const providerDeadline = Date.now() + PROVIDER_DEADLINE_MS;
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const deepgram = process.env.DEEPGRAM_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const keyterms = [
    ...DEFAULT_KEYTERMS,
    ...new URL(req.url).searchParams.getAll("keyterm"),
  ]
    .map((term) => term.trim().slice(0, 80))
    .filter(Boolean)
    .filter((term, index, all) => all.indexOf(term) === index)
    .slice(0, 100);

  // Voice capture cannot measure duration, so the header remains optional. A
  // chunked Studio request that does supply it must stay inside the supported
  // ten-minute provider window.
  const durationHeader = req.headers.get("x-audio-duration");
  const expectedDuration = durationHeader === null ? 0 : Number(durationHeader);
  if (
    durationHeader !== null &&
    (!Number.isFinite(expectedDuration) ||
      expectedDuration <= 0 ||
      expectedDuration > MAX_AUDIO_DURATION_SECONDS)
  ) {
    return Response.json({ error: "invalid_audio_duration" }, { status: 400 });
  }

  // Two ways a take arrives. A browser posts the audio, because it has nowhere
  // to put it first. The editor uploads it to storage and sends the key, which
  // is what lets a long take through at all: the audio never passes through
  // this function, so the hosting body limit stops capping the recording.
  const stored = (req.headers.get("content-type") ?? "").includes(
    "application/json",
  );
  let audio: ArrayBuffer | null = null;
  let contentType = "audio/mp4";
  let storedKey: string | null = null;
  let discardStoredKey = false;
  let durableVideoMaster = false;

  if (stored) {
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
    const value = body as { key?: unknown; submissionId?: unknown } | null;
    const key = value?.key;
    const submissionId = value?.submissionId;
    if (typeof key === "string" && isTranscriptionKey(userId, key)) {
      // Scratch audio uploaded only for this request.
      storedKey = key;
      discardStoredKey = true;
    } else if (typeof submissionId === "string") {
      // Poster uploads already have a durable master in R2. Resolve it through
      // the owner-scoped submission row rather than accepting a raw key from
      // the browser, and never delete that master after transcription.
      storedKey = await getOwnedMediaKey(userId, submissionId);
      contentType = "video/mp4";
      durableVideoMaster = true;
      if (!storedKey) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
    } else {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
  } else {
    try {
      const body = await readBoundedBody(req, {
        maxBytes: MAX_AUDIO_BYTES,
        allowedMediaTypes: AUDIO_MEDIA_TYPES,
        requireContentType: true,
      });
      audio = body.bytes.buffer;
      contentType = body.mediaType as string;
    } catch (error) {
      const response = requestBodyErrorResponse(error);
      if (response) return response;
      throw error;
    }
    if (audio.byteLength === 0) {
      return Response.json({ error: "empty_audio" }, { status: 400 });
    }
  }
  // How many seconds of audio the client built. Hosting infrastructure can cap
  // a body before this route runs, and some proxies truncate bodies silently.
  // The client now sends upload-safe chunks; this duration check remains a
  // final guard against ever accepting a chunk whose tail went missing.
  // Deepgram is handed the link when there is one; the backup cannot fetch for
  // itself, so for a stored take it reads the object here instead. That read is
  // outbound, which the hosting body limit has no opinion about.
  const bytes = async (): Promise<ArrayBuffer> =>
    audio ?? (audio = await getObjectBytes(storedKey!));
  const providers: {
    name: string;
    run: (timeoutMs: number) => Promise<AsrResult>;
  }[] = [];
  if (deepgram) {
    providers.push({
      name: "deepgram",
      run: async (timeoutMs) =>
        storedKey
          ? viaDeepgramURL(
              await presignView(storedKey, 900),
              deepgram,
              keyterms,
              req.signal,
              timeoutMs,
            )
          : viaDeepgram(
              await bytes(),
              deepgram,
              contentType,
              keyterms,
              req.signal,
              timeoutMs,
            ),
    });
  }
  // A Poster master can be hundreds of megabytes. Deepgram reads it directly
  // from the signed URL; pulling that whole video into serverless memory just
  // to hand it to Groq would recreate the upload failure this path removes.
  if (groq && !durableVideoMaster) {
    providers.push({
      name: "groq",
      run: async (timeoutMs) =>
        viaOpenAiCompatible(
          await bytes(),
          groq,
          "https://api.groq.com/openai/v1",
          "whisper-large-v3",
          contentType,
          keyterms,
          req.signal,
          timeoutMs,
        ),
    });
  }
  if (providers.length === 0) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  const billing = await preflightPaidActionOrResponse(userId, "transcribe");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "transcribe");
  if (spendLimited) return spendLimited;

  const access = await reservePaidActionOrResponse(userId, "transcribe");
  if (access.response) return access.response;
  const { reservation } = access;

  // The take's audio exists for this request and no longer. Deepgram has
  // already fetched it by the time any of these paths return, so nothing is
  // waiting on the bytes, and a creator is not paying to store a copy of a
  // video they have on their own disk.
  const discard = async () => {
    if (!storedKey || !discardStoredKey) return;
    try {
      await discardTranscriptionAudio(storedKey);
    } catch (error) {
      console.error("[transcribe] could not discard stored audio", error);
    }
  };

  let lastError: unknown;
  for (const provider of providers) {
    const remainingMs = providerDeadline - Date.now();
    if (remainingMs <= 0 || req.signal.aborted) {
      lastError = new OutboundHttpError(
        req.signal.aborted ? "aborted" : "timeout",
      );
      break;
    }
    try {
      const { words, heardSec } = await provider.run(remainingMs);
      if (req.signal.aborted) {
        throw new OutboundHttpError("aborted", { cause: req.signal.reason });
      }
      if (Date.now() >= providerDeadline) {
        throw new OutboundHttpError("timeout");
      }
      if (isAudioTruncated(expectedDuration, heardSec)) {
        // The ASR heard less than the client sent: the body was truncated in
        // transit. Refuse rather than return a transcript missing its tail.
        await refundCreditReservation(userId, reservation, "audio_truncated");
        await discard();
        return Response.json(
          {
            error: "audio_truncated",
            expectedSec: expectedDuration,
            heardSec,
          },
          { status: 413 },
        );
      }
      await discard();
      return Response.json({ words, balance: reservation.balance });
    } catch (e) {
      lastError = e;
      console.error(`[transcribe] ${provider.name} failed`, e);
      // Cancellation and expiry are terminal. Falling through would start
      // another provider after the caller left or the route budget elapsed.
      if (
        req.signal.aborted ||
        (e instanceof OutboundHttpError &&
          (e.code === "aborted" || e.code === "timeout"))
      ) {
        break;
      }
    }
  }
  await discard();
  await refundCreditReservation(
    userId,
    reservation,
    lastError instanceof Error ? lastError.message : "transcribe_failed",
  );
  return Response.json(
    {
      error:
        lastError instanceof Error ? lastError.message : "transcribe_failed",
    },
    {
      status:
        lastError instanceof OutboundHttpError && lastError.code === "timeout"
          ? 504
          : lastError instanceof OutboundHttpError &&
              lastError.code === "aborted"
            ? 499
            : 502,
    },
  );
}
