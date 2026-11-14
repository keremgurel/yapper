/** Length and list cost of one speech to text reply. */
export interface AudioUsage {
  model: string;
  audioSeconds: number;
  /** What the provider charges at list price for that much audio. */
  listCostMicrousd: number;
}

/**
 * List prices in micro-dollars per audio minute, read from each vendor's
 * pricing page on 2026-11-13. Budgets use list on purpose, as the text models
 * do. A transcriber missing from here keeps its whole reservation.
 */
const DEEPGRAM_PER_MINUTE = 4_300;
const DEEPGRAM_KEYTERMS_PER_MINUTE = 1_300;
/** $0.20 an hour. */
const SCRIBE_PER_MINUTE = 200_000 / 60;
/** Keyterms add $0.05 an hour, a quarter of the base price. */
const SCRIBE_KEYTERMS_FACTOR = 1.25;
/** whisper-large-v3 at $0.111 an hour. */
const GROQ_WHISPER_PER_MINUTE = 111_000 / 60;
/** Groq bills at least this much audio for any request. */
const GROQ_MINIMUM_SECONDS = 10;

function seconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function formValue(init: RequestInit, name: string): string | null {
  if (!(init.body instanceof FormData)) return null;
  const value = init.body.get(name);
  return typeof value === "string" ? value : null;
}

/**
 * What a successful transcription reply cost, from the audio length the
 * provider says it decoded. Null when the reply is not from a transcriber
 * priced here or carries no length, so the caller keeps the reservation.
 */
export function readAudioUsage(
  url: URL,
  init: RequestInit,
  bytes: Uint8Array,
): AudioUsage | null {
  const deepgram =
    url.hostname === "api.deepgram.com" && url.pathname === "/v1/listen";
  const scribe =
    url.hostname === "api.elevenlabs.io" &&
    url.pathname === "/v1/speech-to-text";
  const groq =
    url.hostname === "api.groq.com" &&
    url.pathname.endsWith("/audio/transcriptions");
  if (!deepgram && !scribe && !groq) return null;

  let body: {
    metadata?: { duration?: unknown };
    audio_duration_secs?: unknown;
    duration?: unknown;
  };
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;

  if (deepgram) {
    const heard = seconds(body.metadata?.duration);
    if (heard === null) return null;
    const keyterms =
      url.searchParams.has("keyterm") || url.searchParams.has("keywords");
    return usage(
      url.searchParams.get("model") ?? "nova-3",
      heard,
      DEEPGRAM_PER_MINUTE + (keyterms ? DEEPGRAM_KEYTERMS_PER_MINUTE : 0),
    );
  }
  if (scribe) {
    const heard = seconds(body.audio_duration_secs);
    if (heard === null) return null;
    const keyterms = init.body instanceof FormData && init.body.has("keyterms");
    return usage(
      formValue(init, "model_id") ?? "scribe",
      heard,
      SCRIBE_PER_MINUTE * (keyterms ? SCRIBE_KEYTERMS_FACTOR : 1),
    );
  }
  const heard = seconds(body.duration);
  if (heard === null) return null;
  return usage(
    formValue(init, "model") ?? "whisper-large-v3",
    heard,
    GROQ_WHISPER_PER_MINUTE,
    Math.max(heard, GROQ_MINIMUM_SECONDS),
  );
}

function usage(
  model: string,
  audioSeconds: number,
  perMinute: number,
  billedSeconds = audioSeconds,
): AudioUsage {
  return {
    model,
    audioSeconds,
    listCostMicrousd: Math.ceil((billedSeconds / 60) * perMinute),
  };
}
