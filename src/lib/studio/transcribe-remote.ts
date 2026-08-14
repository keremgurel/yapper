import {
  buildAsrAudioChunks,
  chunkMono16k,
  type AsrAudio,
} from "@/lib/studio/audio/asr-audio";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import type { TranscriptionDictionaryEntry } from "@/lib/studio/transcription-dictionary";
import { dictionaryKeyterms } from "@/lib/studio/transcription-dictionary";
import { isNative } from "@/lib/studio/native/bridge";
import { nativeMediaForUrl } from "@/lib/studio/native/path-registry";

// Short ASR windows retain quiet/unclear restarts that a long request can
// contextually suppress. Five seconds of overlap gives the anchor merge enough
// shared speech to remove duplicates without cutting a word at the boundary.
const NATIVE_ASR_CHUNK_BYTES = 1_000_000;
const NATIVE_ASR_OVERLAP_SEC = 5;

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
  signal?: AbortSignal,
  preparedChunks?: AsrAudio[],
): Promise<RawWord[]> {
  const keyterms = dictionaryKeyterms(dictionary);

  if (preparedChunks) {
    signal?.throwIfAborted();
    return transcribeAsrChunks(preparedChunks, keyterms, signal);
  }

  // Desktop: ffmpeg has already decoded clean lossless PCM for VAD/waveforms.
  // Upload bounded overlapping WAV chunks from that same PCM. The previous
  // single-file shortcut re-encoded the camera track to 48kbps AAC; on the DJI
  // reference that erased a quiet phrase and the onset of the next take before
  // ASR ever saw them. Native PCM works for DJI, iPhone, and odd containers
  // alike, while the anchor merge below keeps chunk seams deterministic.
  const native = isNative() ? nativeMediaForUrl(url) : undefined;
  if (native) {
    try {
      const pcm = await decodeToMono16k(url, signal);
      return await transcribeAsrChunks(
        chunkMono16k(pcm, NATIVE_ASR_CHUNK_BYTES, NATIVE_ASR_OVERLAP_SEC),
        keyterms,
        signal,
      );
    } catch (e) {
      signal?.throwIfAborted();
      console.warn(
        "[transcribe] native PCM chunks failed, falling back to media demux",
        e,
      );
    }
  }

  let chunks: AsrAudio[];
  try {
    chunks = await buildAsrAudioChunks(url, undefined, undefined, signal);
  } catch (e) {
    signal?.throwIfAborted();
    console.warn(
      "[transcribe] native audio path failed, falling back to 16kHz WAV",
      e,
    );
    const pcm = await decodeToMono16k(url, signal);
    chunks = chunkMono16k(pcm);
  }
  return transcribeAsrChunks(chunks, keyterms, signal);
}

interface TranscribedChunk {
  /** Accepted by merge fixtures; transport deliberately never retains it. */
  blob?: Blob;
  via: AsrAudio["via"];
  durationSec: number;
  offsetSec: number;
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
    // An anchor late in the overlap is not necessarily the start of duplicated
    // speech. A short retake can begin after the geometric seam and then share
    // its ending with the left chunk. Throwing away every right-hand word
    // before that late anchor creates a Frankenstein transcript:
    //
    //   left:  "you can see"       ... "what's still"
    //   right:                 "now you can see what's still below..."
    //
    // Anchoring on "what's still" used to discard the complete final restart
    // from the right chunk. If the right chunk owns any word before the anchor,
    // midpoint ownership is the only lossless choice: keep the left prefix and
    // the complete right suffix. The later retake-cleanup pass can then choose
    // between both real attempts instead of receiving a synthetic one.
    const rightOwnsPrefixBeforeAnchor =
      anchor != null &&
      right.slice(0, anchor.right).some((word) => wordMidpoint(word) >= seam);
    if (anchor && !rightOwnsPrefixBeforeAnchor) {
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
  signal?: AbortSignal,
  transport: typeof transcribeRemote = transcribeRemote,
): Promise<RawWord[]> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  const completed: (TranscribedChunk | undefined)[] = Array(chunks.length);
  // Two concurrent uploads keep long recordings responsive without flooding
  // the provider or making all chunks fail together on a transient rate limit.
  // Promise.all is deliberately fail-closed: returning words around a missing
  // chunk would look successful but give one-click editing an incomplete source
  // of truth, which is more dangerous than asking the user to retry.
  let next = 0;
  const worker = async () => {
    while (true) {
      combinedSignal.throwIfAborted();
      const index = next++;
      if (index >= chunks.length) return;
      const chunk = chunks[index];
      // `blob` is a lazy getter for PCM/AAC plans. It is not materialized until
      // this bounded worker admits the chunk.
      const words = await transport(
        chunk.blob,
        chunk.durationSec,
        keyterms,
        combinedSignal,
      );
      // Never spread the chunk: `blob` may be a lazy getter, and retaining it
      // would recreate every payload and keep O(recording) bytes alive until
      // the final seam merge.
      completed[index] = {
        via: chunk.via,
        durationSec: chunk.durationSec,
        offsetSec: chunk.offsetSec,
        words,
      };
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(2, chunks.length) }, () => worker()),
    );
  } catch (error) {
    controller.abort(error);
    throw error;
  }
  return mergeTranscribedChunks(
    completed.filter((chunk): chunk is TranscribedChunk => chunk !== undefined),
  );
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
  signal?: AbortSignal,
): Promise<RawWord[]> {
  const params = new URLSearchParams();
  for (const term of keyterms) params.append("keyterm", term);
  const endpoint = `/api/transcribe${params.size ? `?${params}` : ""}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": audio.type || "application/octet-stream",
          ...(durationSec > 0
            ? { "x-audio-duration": String(durationSec) }
            : {}),
        },
        body: audio,
        signal,
      });
      if (res.status === 501) throw new Error("transcribe_no_provider");
      if (res.status === 413) throw new Error("transcribe_audio_truncated");
      if (!res.ok) {
        const error = new Error(`remote_transcribe_${res.status}`);
        if (
          res.status !== 408 &&
          res.status !== 429 &&
          (res.status < 500 || res.status > 599)
        ) {
          throw Object.assign(error, { terminal: true });
        }
        throw error;
      }
      const data = (await res.json()) as { words?: RawWord[] };
      return data.words ?? [];
    } catch (error) {
      signal?.throwIfAborted();
      if ((error as { terminal?: boolean }).terminal) throw error;
      if (
        error instanceof Error &&
        (error.message === "transcribe_no_provider" ||
          error.message === "transcribe_audio_truncated")
      ) {
        throw error;
      }
      lastError = error;
      if (attempt === 0) await abortableDelay(250, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("remote_transcribe");
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
