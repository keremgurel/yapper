import { fetchBoundedJson } from "@/lib/http/outbound";
import { type AsrResult, fileExtension } from "./providers";

const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const MAX_PROVIDER_RESPONSE_BYTES = 4_000_000;

interface ScribeWord {
  text?: unknown;
  start?: unknown;
  end?: unknown;
  type?: unknown;
}

interface ScribeResponse {
  audio_duration_secs?: unknown;
  words?: ScribeWord[];
}

/**
 * The dictionary terms Scribe will accept. It refuses the whole request when
 * a term is over 50 characters, over 5 words, or holds one of `< > { } [ ] \`,
 * and Deepgram's limits are looser, so a term that is fine there is dropped
 * here instead of failing the take.
 */
export function scribeKeyterms(terms: readonly string[]): string[] {
  return terms.filter(
    (term) =>
      term.length <= 50 &&
      term.split(/\s+/).length <= 5 &&
      !/[<>{}[\]\\]/.test(term),
  );
}

function fromScribe(json: ScribeResponse): AsrResult {
  const words = Array.isArray(json?.words) ? json.words : [];
  return {
    // The length of audio Scribe decoded, which is the truncation signal.
    heardSec: Number(json?.audio_duration_secs ?? 0),
    // Scribe lists the gaps between words and audio events as items of their
    // own. Only spoken words with both times are a transcript.
    words: words.flatMap((word) =>
      word.type === "word" &&
      typeof word.text === "string" &&
      typeof word.start === "number" &&
      typeof word.end === "number"
        ? [{ text: word.text, start: word.start, end: word.end }]
        : [],
    ),
  };
}

/**
 * ElevenLabs Scribe with the audio in the request body.
 *
 * Verbatim is Scribe's default and is left on: an edit needs the false starts
 * and filler words, because they are what marks a retake. Audio event tags
 * are turned off so "[clears throat]" never reaches the transcript.
 */
export async function viaElevenLabs(
  audio: ArrayBuffer,
  key: string,
  contentType: string,
  keyterms: readonly string[],
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AsrResult> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2");
  // English, as Deepgram's default is. Left to detect the language, Scribe
  // judges each piece on its own and writes the same speech two ways ("2026"
  // in one piece, "twenty twenty-six" in the next), which the seam merge then
  // interleaves. Measured in docs/transcription-and-edit-eval-2026-11.md.
  form.append("language_code", "en");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  for (const term of scribeKeyterms(keyterms)) form.append("keyterms", term);
  form.append(
    "file",
    new File([audio], `audio.${fileExtension(contentType)}`, {
      type: contentType,
    }),
  );
  const { response, data } = await fetchBoundedJson<ScribeResponse>(
    ENDPOINT,
    { method: "POST", headers: { "xi-api-key": key }, body: form },
    { timeoutMs, maxBytes: MAX_PROVIDER_RESPONSE_BYTES, signal },
  );
  if (!response.ok) throw new Error(`elevenlabs_${response.status}`);
  return fromScribe(data);
}
