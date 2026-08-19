import type { RawWord } from "@/lib/studio/transcription-dictionary";
import { fetchBoundedJson } from "@/lib/http/outbound";

/** An ASR result plus how many seconds of audio the provider actually heard. */
export interface AsrResult {
  words: RawWord[];
  heardSec: number;
}

const MAX_PROVIDER_RESPONSE_BYTES = 4_000_000;

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  punctuated_word?: string;
}

interface DeepgramResponse {
  metadata?: { duration?: unknown };
  results?: { channels?: { alternatives?: { words?: DeepgramWord[] }[] }[] };
}

function listenEndpoint(keyterms: string[]): URL {
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
  return endpoint;
}

function fromDeepgram(json: DeepgramResponse): AsrResult {
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

/** Deepgram with the audio in the request body. */
export async function viaDeepgram(
  audio: ArrayBuffer,
  key: string,
  contentType: string,
  keyterms: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const { response, data } = await fetchBoundedJson<DeepgramResponse>(
    listenEndpoint(keyterms),
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
      body: audio,
    },
    { timeoutMs, maxBytes: MAX_PROVIDER_RESPONSE_BYTES, signal },
  );
  if (!response.ok) throw new Error(`deepgram_${response.status}`);
  return fromDeepgram(data);
}

/**
 * Deepgram with the audio left where it is.
 *
 * Handed a link, Deepgram fetches the recording itself, so the request this
 * route makes is a few hundred bytes whatever the take's length. That is the
 * whole point: audio never passes through the function, so the hosting body
 * limit stops deciding how long a video may be, and the take no longer has to
 * be cut into upload-sized pieces and stitched back together afterwards.
 */
export async function viaDeepgramURL(
  audioURL: string,
  key: string,
  keyterms: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const { response, data } = await fetchBoundedJson<DeepgramResponse>(
    listenEndpoint(keyterms),
    {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioURL }),
    },
    { timeoutMs, maxBytes: MAX_PROVIDER_RESPONSE_BYTES, signal },
  );
  if (!response.ok) throw new Error(`deepgram_${response.status}`);
  return fromDeepgram(data);
}

/**
 * What to call the upload so the fallback transcriber parses it.
 *
 * Whisper picks its demuxer partly from the filename, and the editor now sends
 * AAC in an MPEG-4 container rather than raw PCM, which would have arrived
 * named audio.wav.
 */
export function fileExtension(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("aac")) return "aac";
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("quicktime")) return "mov";
  return "wav";
}

interface OpenAiWord {
  word: string;
  start: number;
  end: number;
}

export async function viaOpenAiCompatible(
  audio: ArrayBuffer,
  key: string,
  base: string,
  model: string,
  contentType: string,
  keyterms: string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const ext = fileExtension(contentType);
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
