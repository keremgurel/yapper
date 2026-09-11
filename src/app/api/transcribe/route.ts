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
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import { getOwnedMediaKey } from "@/lib/db/submissions";
import { mergeAsrChunks, type TimedAsrChunk } from "@/lib/transcription/chunks";

import {
  uncoveredSpeech,
  recoverWords,
  mapTranscriptionWork,
  type SpeechRange,
} from "@/lib/transcription/coverage";

export const runtime = "nodejs";
export const maxDuration = 120;

// Core product vocabulary should be correct on a brand-new install, before a
// creator has had a chance to build their personal transcription dictionary.
const DEFAULT_KEYTERMS = ["CELPIP", "Yapper"];
const MAX_AUDIO_BYTES = 4_000_000;
const MAX_AUDIO_DURATION_SECONDS = 600;
// Dense overlap gives retake-heavy recordings more than one useful ASR
// context. Forty chunks cover the full supported hour at 120s/30s overlap;
// leave room for the short tail without weakening the total-duration bound.
const MAX_STORED_CHUNKS = 48;
const MAX_STORED_TAKE_SECONDS = 3_600;
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
  let storedChunks: { key: string; offset: number; duration: number }[] = [];
  let durableVideoMaster = false;
  let recoveryChunks: { key: string; offset: number; duration: number }[] = [];
  let speech: SpeechRange[] | undefined;

  if (stored) {
    if (!r2Configured())
      return Response.json({ error: "no_storage" }, { status: 501 });
    let body: unknown;
    try {
      body = await readBoundedJson(req, { maxBytes: 256 * 1024 });
    } catch (error) {
      const response = requestBodyErrorResponse(error);
      if (response) return response;
      throw error;
    }
    const value = body as {
      key?: unknown;
      chunks?: unknown;
      submissionId?: unknown;
      mediaKey?: unknown;
      recoveryChunks?: unknown;
      speech?: unknown;
    } | null;
    const key = value?.key;
    const chunks = value?.chunks;
    const submissionId = value?.submissionId;
    if (typeof key === "string" && isTranscriptionKey(userId, key)) {
      // Legacy native clients upload one whole take.
      storedChunks = [{ key, offset: 0, duration: 0 }];
    } else if (
      Array.isArray(chunks) &&
      chunks.length > 0 &&
      chunks.length <= MAX_STORED_CHUNKS
    ) {
      const parsed = chunks.map((chunk) => {
        const candidate = chunk as {
          key?: unknown;
          offset?: unknown;
          duration?: unknown;
        };
        return {
          key: candidate.key,
          offset: Number(candidate.offset),
          duration: Number(candidate.duration),
        };
      });
      const valid = parsed.every(
        (chunk, index) =>
          typeof chunk.key === "string" &&
          isTranscriptionKey(userId, chunk.key) &&
          parsed.findIndex((candidate) => candidate.key === chunk.key) ===
            index &&
          Number.isFinite(chunk.offset) &&
          chunk.offset >= 0 &&
          (index === 0
            ? chunk.offset === 0
            : chunk.offset <=
              parsed[index - 1]!.offset +
                parsed[index - 1]!.duration +
                0.001) &&
          (index === 0 || chunk.offset > parsed[index - 1]!.offset) &&
          Number.isFinite(chunk.duration) &&
          chunk.duration > 0 &&
          chunk.duration <= MAX_AUDIO_DURATION_SECONDS &&
          chunk.offset + chunk.duration <= MAX_STORED_TAKE_SECONDS,
      );
      if (!valid)
        return Response.json({ error: "bad_request" }, { status: 400 });
      storedChunks = parsed as {
        key: string;
        offset: number;
        duration: number;
      }[];
    } else if (typeof submissionId === "string") {
      // Poster uploads already have a durable master in R2. Resolve it through
      // the owner-scoped submission row rather than accepting a raw key from
      // the browser, and never delete that master after transcription.
      const storedKey = await getOwnedMediaKey(userId, submissionId);
      contentType = "video/mp4";
      durableVideoMaster = true;
      if (!storedKey) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      storedChunks = [{ key: storedKey, offset: 0, duration: 0 }];
    } else if (typeof value?.mediaKey === "string") {
      const media = await resolveOwnedMediaKey(userId, {
        mediaKey: value.mediaKey,
      });
      if (!media.ok)
        return Response.json({ error: media.error }, { status: media.status });
      durableVideoMaster = true;
      contentType = "video/mp4";
      storedChunks = [{ key: media.mediaKey, offset: 0, duration: 0 }];
    } else {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    if (value?.recoveryChunks !== undefined || value?.speech !== undefined) {
      const recovery = value.recoveryChunks;
      const ranges = value.speech;
      const duration = Math.max(
        ...storedChunks.map((chunk) => chunk.offset + chunk.duration),
      );
      if (
        durableVideoMaster ||
        !Array.isArray(chunks) ||
        !Array.isArray(recovery) ||
        recovery.length > 600 ||
        !Array.isArray(ranges) ||
        ranges.length > 7200
      ) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      const keys = new Set(storedChunks.map((chunk) => chunk.key));
      for (const chunk of recovery) {
        if (
          !chunk ||
          typeof chunk.key !== "string" ||
          !isTranscriptionKey(userId, chunk.key) ||
          keys.has(chunk.key) ||
          !Number.isFinite(chunk.offset) ||
          chunk.offset < 0 ||
          !Number.isFinite(chunk.duration) ||
          chunk.duration <= 0 ||
          chunk.duration > 10.01 ||
          chunk.offset + chunk.duration > duration + 0.001
        ) {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        keys.add(chunk.key);
      }
      // Limit duplicated audio as well as object count, so a recovery plan
      // cannot multiply provider work without bound.
      if (
        recovery.reduce((sum, chunk) => sum + chunk.duration, 0) >
          duration * 2 + 10 ||
        !ranges.every(
          (range, index) =>
            Array.isArray(range) &&
            range.length === 2 &&
            range.every(Number.isFinite) &&
            range[0] >= 0 &&
            range[1] > range[0] &&
            range[1] <= duration + 0.1 &&
            (index === 0 || range[0] >= ranges[index - 1][1]),
        )
      ) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      recoveryChunks = recovery;
      speech = ranges;
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
  const bytes = async (key?: string): Promise<ArrayBuffer> =>
    key ? getObjectBytes(key) : audio!;
  const transcribeStored = async (
    run: (
      chunk: { key: string; offset: number; duration: number },
      timeoutMs: number,
    ) => Promise<AsrResult>,
    timeoutMs: number,
  ): Promise<AsrResult> => {
    const completed = await mapTranscriptionWork(
      storedChunks,
      async (chunk): Promise<TimedAsrChunk> => {
        const remaining = Math.min(timeoutMs, providerDeadline - Date.now());
        if (remaining <= 0 || req.signal.aborted)
          throw new OutboundHttpError(
            req.signal.aborted ? "aborted" : "timeout",
          );
        return {
          ...(await run(chunk, remaining)),
          offset: chunk.offset,
          duration: chunk.duration,
        };
      },
    );
    // The last chunk reaching the end says nothing about earlier chunks.
    // Validate each decoded duration before merging; otherwise a truncated
    // middle upload silently becomes missing speech in the transcript tab.
    for (const chunk of completed) {
      if (
        chunk.duration > 0 &&
        (!Number.isFinite(chunk.heardSec) ||
          chunk.heardSec <= 0 ||
          isAudioTruncated(chunk.duration, chunk.heardSec))
      ) {
        throw new Error("audio_truncated");
      }
    }
    return mergeAsrChunks(completed);
  };
  const providers: {
    name: string;
    run: (timeoutMs: number) => Promise<AsrResult>;
  }[] = [];
  if (deepgram) {
    providers.push({
      name: "deepgram",
      run: async (timeoutMs) =>
        storedChunks.length > 0
          ? transcribeStored(
              async (chunk, chunkTimeoutMs) =>
                viaDeepgramURL(
                  await presignView(chunk.key, 900),
                  deepgram,
                  keyterms,
                  req.signal,
                  chunkTimeoutMs,
                ),
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
        storedChunks.length > 0
          ? transcribeStored(
              async (chunk, chunkTimeoutMs) =>
                viaOpenAiCompatible(
                  await bytes(chunk.key),
                  groq,
                  "https://api.groq.com/openai/v1",
                  "whisper-large-v3",
                  "audio/mp4",
                  keyterms,
                  req.signal,
                  chunkTimeoutMs,
                ),
              timeoutMs,
            )
          : viaOpenAiCompatible(
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
    if (durableVideoMaster || storedChunks.length === 0) return;
    await Promise.all(
      [...storedChunks, ...recoveryChunks].map(async ({ key }) => {
        try {
          await discardTranscriptionAudio(key);
        } catch (error) {
          console.error("[transcribe] could not discard stored audio", error);
        }
      }),
    );
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
      const result = await provider.run(remainingMs);
      const heardSec = result.heardSec;
      let words = result.words;
      if (speech !== undefined) {
        // A successful HTTP response is not proof that all speech was heard.
        // Retry only windows containing independently detected missing speech.
        let missing = uncoveredSpeech(words, speech);
        const pending = new Set(recoveryChunks);
        for (let round = 0; round < 2 && missing.length > 0; round++) {
          const selected = [
            ...new Set(
              missing.flatMap(([start, end]) => {
                const center = (start + end) / 2;
                const candidates = [...pending]
                  .filter(
                    (chunk) =>
                      chunk.offset < end &&
                      chunk.offset + chunk.duration > start,
                  )
                  .sort(
                    (a, b) =>
                      Math.abs(a.offset + a.duration / 2 - center) -
                      Math.abs(b.offset + b.duration / 2 - center),
                  );
                return candidates.slice(0, 1);
              }),
            ),
          ];
          if (selected.length === 0) break;
          const recovered = await mapTranscriptionWork(
            selected,
            async (chunk): Promise<TimedAsrChunk> => {
              pending.delete(chunk);
              const remaining = providerDeadline - Date.now();
              if (remaining <= 0 || req.signal.aborted)
                throw new OutboundHttpError(
                  req.signal.aborted ? "aborted" : "timeout",
                );
              const result = deepgram
                ? await viaDeepgramURL(
                    await presignView(chunk.key, 900),
                    deepgram,
                    keyterms,
                    req.signal,
                    remaining,
                    round === 0 ? "nova-2" : "nova-3",
                  )
                : await viaOpenAiCompatible(
                    await bytes(chunk.key),
                    groq!,
                    "https://api.groq.com/openai/v1",
                    "whisper-large-v3",
                    "audio/mp4",
                    keyterms,
                    req.signal,
                    remaining,
                  );
              if (
                !Number.isFinite(result.heardSec) ||
                result.heardSec <= 0 ||
                isAudioTruncated(chunk.duration, result.heardSec)
              )
                throw new Error("audio_truncated");
              return {
                ...result,
                offset: chunk.offset,
                duration: chunk.duration,
              };
            },
          );
          for (const chunk of recovered.sort((a, b) => a.offset - b.offset))
            words = recoverWords(words, chunk);
          missing = uncoveredSpeech(words, speech);
        }
        if (missing.length > 0) {
          // Do not run cleanup against an incomplete transcript or charge for
          // a transcript we refused. A different long-context provider may
          // still suppress the same speech, so this is terminal.
          await refundCreditReservation(
            userId,
            reservation,
            "transcription_incomplete",
          );
          await discard();
          return Response.json(
            { error: "transcription_incomplete", missing },
            { status: 422 },
          );
        }
      }
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
      return Response.json({
        words,
        coverageChecked: speech !== undefined,
        balance: reservation.balance,
      });
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
