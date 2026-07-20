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

const seamToken = (text: string) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}']+/gu, "");

const wordMidpoint = (word: RawWord) => (word.start + word.end) / 2;

interface SeamAnchor {
  left: number;
  right: number;
}

/** Find the same spoken word on both sides of an overlapping chunk seam. */
function findSeamAnchor(
  left: RawWord[],
  right: RawWord[],
  seam: number,
): SeamAnchor | null {
  let best: { anchor: SeamAnchor; score: number } | null = null;
  for (let i = 0; i < left.length; i++) {
    const token = seamToken(left[i].text);
    if (!token || Math.abs(wordMidpoint(left[i]) - seam) > 3) continue;
    for (let j = 0; j < right.length; j++) {
      if (seamToken(right[j].text) !== token) continue;
      const timeDelta = Math.abs(
        wordMidpoint(left[i]) - wordMidpoint(right[j]),
      );
      if (timeDelta > 1.5) continue;

      let contextMatches = 0;
      for (let offset = -2; offset <= 2; offset++) {
        const a = seamToken(left[i + offset]?.text ?? "");
        const b = seamToken(right[j + offset]?.text ?? "");
        if (a && a === b) contextMatches++;
      }
      // A neighboring token protects common words from anchoring to the wrong
      // repeat. A distinctive word with nearly identical timing is safe alone.
      if (contextMatches < 2 && !(token.length >= 5 && timeDelta <= 0.35)) {
        continue;
      }
      const seamDistance = Math.abs(
        (wordMidpoint(left[i]) + wordMidpoint(right[j])) / 2 - seam,
      );
      const score = contextMatches * 10 - timeDelta - seamDistance * 0.1;
      if (!best || score > best.score) {
        best = { anchor: { left: i, right: j }, score };
      }
    }
  }
  return best?.anchor ?? null;
}

/**
 * Merge overlapping ASR responses at a shared textual anchor near each seam.
 * Providers can shift the same word's timestamp across the geometric midpoint;
 * anchoring on token + local context prevents that word being duplicated or
 * dropped. If the two transcripts share no trustworthy anchor, fall back to
 * midpoint ownership—the conservative deterministic behavior.
 */
export function mergeTranscribedChunks(chunks: TranscribedChunk[]): RawWord[] {
  if (chunks.length === 0) return [];
  const shifted = chunks.map((chunk) =>
    chunk.words.map((word) => ({
      ...word,
      start: word.start + chunk.offsetSec,
      end: word.end + chunk.offsetSec,
    })),
  );
  const merged = [...shifted[0]];
  for (let index = 1; index < chunks.length; index++) {
    const left = shifted[index - 1];
    const right = shifted[index];
    const seam =
      (chunks[index].offsetSec +
        chunks[index - 1].offsetSec +
        chunks[index - 1].durationSec) /
      2;
    const anchor = findSeamAnchor(left, right, seam);
    if (anchor) {
      // Keep the left copy of the anchor, remove the remainder of that chunk,
      // then continue immediately after the right copy of the same word.
      const trailingLeftWords = left.length - anchor.left - 1;
      if (trailingLeftWords > 0) {
        merged.splice(
          Math.max(0, merged.length - trailingLeftWords),
          trailingLeftWords,
        );
      }
      merged.push(...right.slice(anchor.right + 1));
      continue;
    }

    while (
      merged.length > 0 &&
      wordMidpoint(merged[merged.length - 1]) >= seam
    ) {
      merged.pop();
    }
    merged.push(...right.filter((word) => wordMidpoint(word) >= seam));
  }
  return merged;
}

export async function transcribeAsrChunks(
  chunks: AsrAudio[],
  keyterms: string[],
): Promise<RawWord[]> {
  const completed: TranscribedChunk[] = [];
  // Two concurrent uploads keep long recordings responsive without flooding
  // the provider or making all chunks fail together on a transient rate limit.
  // Promise.all is deliberately fail-closed: returning words around a missing
  // chunk would look successful but give one-click editing an incomplete source
  // of truth, which is more dangerous than asking the user to retry.
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
