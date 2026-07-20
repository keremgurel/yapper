import {
  buildAsrAudioChunks,
  chunkMono16k,
  type AsrAudio,
} from "@/lib/studio/audio/asr-audio";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import type { TranscriptionDictionaryEntry } from "@/lib/studio/transcription-dictionary";
import { dictionaryKeyterms } from "@/lib/studio/transcription-dictionary";

export interface RawWord {
  text: string;
  start: number;
  end: number;
}

/**
 * Transcribe a media URL, sending the ASR the ORIGINAL native-rate audio (AAC,
 * or a native-rate mono WAV). This is the accurate path: resampling to 16 kHz
 * in-browser smears closely-spaced retakes so the model merges them and drops
 * words. Falls back to a 16 kHz WAV only if no native payload can be built
 * (a container mp4box/WebCodecs can't read).
 */
export async function transcribeUrl(
  url: string,
  dictionary: TranscriptionDictionaryEntry[] = [],
): Promise<RawWord[]> {
  const keyterms = dictionaryKeyterms(dictionary);
  let chunks: AsrAudio[];
  try {
    chunks = await buildAsrAudioChunks(url);
  } catch (e) {
    console.warn(
      "[transcribe] native audio path failed, falling back to 16kHz WAV",
      e,
    );
    const pcm = await decodeToMono16k(url);
    chunks = chunkMono16k(pcm);
  }
  return transcribeAsrChunks(chunks, keyterms);
}

interface TranscribedChunk extends AsrAudio {
  words: RawWord[];
}

/**
 * Merge overlapping ASR responses without fuzzy text matching. Each chunk owns
 * the audio up to the midpoint of its overlap with the next, which removes
 * duplicates while leaving every source timestamp represented exactly once.
 */
export function mergeTranscribedChunks(chunks: TranscribedChunk[]): RawWord[] {
  return chunks.flatMap((chunk, index) => {
    const previous = chunks[index - 1];
    const next = chunks[index + 1];
    const lower = previous
      ? (chunk.offsetSec + previous.offsetSec + previous.durationSec) / 2
      : Number.NEGATIVE_INFINITY;
    const upper = next
      ? (next.offsetSec + chunk.offsetSec + chunk.durationSec) / 2
      : Number.POSITIVE_INFINITY;
    return chunk.words
      .map((word) => ({
        ...word,
        start: word.start + chunk.offsetSec,
        end: word.end + chunk.offsetSec,
      }))
      .filter((word) => {
        const midpoint = (word.start + word.end) / 2;
        return midpoint >= lower && midpoint < upper;
      });
  });
}

export async function transcribeAsrChunks(
  chunks: AsrAudio[],
  keyterms: string[],
): Promise<RawWord[]> {
  const completed: TranscribedChunk[] = [];
  // Two concurrent uploads keep long recordings responsive without flooding
  // the provider or making all chunks fail together on a transient rate limit.
  for (let i = 0; i < chunks.length; i += 2) {
    const batch = chunks.slice(i, i + 2);
    completed.push(
      ...(await Promise.all(
        batch.map(async (chunk) => ({
          ...chunk,
          words: await transcribeRemote(
            chunk.blob,
            chunk.durationSec,
            keyterms,
          ),
        })),
      )),
    );
  }
  return mergeTranscribedChunks(completed);
}

/**
 * POST an audio payload to the backend (/api/transcribe → Deepgram, our
 * transcriber of record) and return word-level timings.
 *
 * There is no on-device fallback: hosted transcription is the only path, so any
 * failure is surfaced rather than silently downgraded. A transient failure
 * (network blip, 5xx) is retried once; a missing provider (HTTP 501) or a
 * persistent error throws so the caller can show an error and let the user
 * retry, instead of producing a quietly worse transcript.
 */
export async function transcribeRemote(
  audio: Blob,
  durationSec = 0,
  keyterms: string[] = [],
): Promise<RawWord[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const params = new URLSearchParams();
      for (const term of keyterms) params.append("keyterm", term);
      const endpoint = `/api/transcribe${params.size ? `?${params}` : ""}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": audio.type || "application/octet-stream",
          // Lets the backend detect a body truncated in transit by the
          // proxy/middleware size cap (it hears less than we sent).
          ...(durationSec > 0
            ? { "x-audio-duration": String(durationSec) }
            : {}),
        },
        body: audio,
      });
      if (res.status === 501) {
        throw new Error("transcribe_no_provider");
      }
      if (res.status === 413) {
        throw new Error("transcribe_audio_truncated");
      }
      if (!res.ok) throw new Error(`remote_transcribe_${res.status}`);
      const data = (await res.json()) as { words?: RawWord[] };
      return data.words ?? [];
    } catch (e) {
      lastErr = e;
      // Neither a missing provider nor a truncated upload fixes itself on a
      // retry — fail fast so the caller can surface it.
      if (
        e instanceof Error &&
        (e.message === "transcribe_no_provider" ||
          e.message === "transcribe_audio_truncated")
      ) {
        throw e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("remote_transcribe");
}
