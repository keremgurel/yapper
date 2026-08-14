import { auth } from "@clerk/nextjs/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { isAudioTruncated } from "@/lib/studio/transcribe-guard";
import type { RawWord } from "@/lib/studio/transcribe-remote";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedBody,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { fetchBoundedJson, OutboundHttpError } from "@/lib/http/outbound";

export const runtime = "nodejs";
export const maxDuration = 120;

// Core product vocabulary should be correct on a brand-new install, before a
// creator has had a chance to build their personal transcription dictionary.
const DEFAULT_KEYTERMS = ["CELPIP", "Yapper"];
const MAX_AUDIO_BYTES = 4_000_000;
const MAX_AUDIO_DURATION_SECONDS = 600;
const PROVIDER_DEADLINE_MS = 108_000;
const MAX_PROVIDER_RESPONSE_BYTES = 4_000_000;
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

/** An ASR result plus how many seconds of audio the provider actually heard. */
interface AsrResult {
  words: RawWord[];
  heardSec: number;
}

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

  let audio: ArrayBuffer;
  let contentType: string;
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
  // How many seconds of audio the client built. Hosting infrastructure can cap
  // a body before this route runs, and some proxies truncate bodies silently.
  // The client now sends upload-safe chunks; this duration check remains a
  // final guard against ever accepting a chunk whose tail went missing.
  const providers: {
    name: string;
    run: (timeoutMs: number) => Promise<AsrResult>;
  }[] = [];
  if (deepgram) {
    providers.push({
      name: "deepgram",
      run: (timeoutMs) =>
        viaDeepgram(
          audio,
          deepgram,
          contentType,
          keyterms,
          req.signal,
          timeoutMs,
        ),
    });
  }
  if (groq) {
    providers.push({
      name: "groq",
      run: (timeoutMs) =>
        viaOpenAiCompatible(
          audio,
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
        return Response.json(
          {
            error: "audio_truncated",
            expectedSec: expectedDuration,
            heardSec,
          },
          { status: 413 },
        );
      }
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

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
}

async function viaDeepgram(
  audio: ArrayBuffer,
  key: string,
  contentType: string,
  keyterms: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const endpoint = new URL("https://api.deepgram.com/v1/listen");
  endpoint.searchParams.set("model", "nova-3");
  endpoint.searchParams.set("smart_format", "true");
  endpoint.searchParams.set("punctuate", "true");
  // Editing needs a verbatim record, not a polished meeting transcript.
  // Deepgram otherwise strips "uh"/"um" by default, which makes audible speech
  // disappear from the transcript and can cause the edit model to cut through
  // a real hesitation or sentence onset.
  endpoint.searchParams.set("filler_words", "true");
  for (const term of keyterms) endpoint.searchParams.append("keyterm", term);
  const { response, data: json } = await fetchBoundedJson<{
    metadata?: { duration?: unknown };
    results?: { channels?: { alternatives?: { words?: DeepgramWord[] }[] }[] };
  }>(
    endpoint,
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
      body: audio,
    },
    { timeoutMs, maxBytes: MAX_PROVIDER_RESPONSE_BYTES, signal },
  );
  if (!response.ok) throw new Error(`deepgram_${response.status}`);
  const words: DeepgramWord[] =
    json?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return {
    // metadata.duration is the length of audio Deepgram actually decoded — the
    // truncation signal.
    heardSec: Number(json?.metadata?.duration ?? 0),
    words: words.map((w) => ({
      text: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
    })),
  };
}

interface OpenAiWord {
  word: string;
  start: number;
  end: number;
}

async function viaOpenAiCompatible(
  audio: ArrayBuffer,
  key: string,
  base: string,
  model: string,
  contentType: string,
  keyterms: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const ext = contentType.includes("aac") ? "aac" : "wav";
  const form = new FormData();
  form.append("file", new File([audio], `audio.${ext}`, { type: contentType }));
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  if (keyterms.length > 0) {
    form.append("prompt", `Preferred vocabulary: ${keyterms.join(", ")}`);
  }
  const { response, data: json } = await fetchBoundedJson<{
    duration?: unknown;
    words?: OpenAiWord[];
  }>(
    `${base}/audio/transcriptions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    },
    { timeoutMs, maxBytes: MAX_PROVIDER_RESPONSE_BYTES, signal },
  );
  if (!response.ok) throw new Error(`asr_${response.status}`);
  const words: OpenAiWord[] = json?.words ?? [];
  return {
    heardSec: Number(json?.duration ?? 0),
    words: words.map((w) => ({ text: w.word, start: w.start, end: w.end })),
  };
}
