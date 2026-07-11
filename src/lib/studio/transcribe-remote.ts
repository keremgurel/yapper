import { buildAsrAudio } from "@/lib/studio/audio/asr-audio";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { encodeWav } from "@/lib/studio/wav";

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
export async function transcribeUrl(url: string): Promise<RawWord[]> {
  try {
    const { blob, durationSec } = await buildAsrAudio(url);
    return await transcribeRemote(blob, durationSec);
  } catch (e) {
    console.warn(
      "[transcribe] native audio path failed, falling back to 16kHz WAV",
      e,
    );
    const pcm = await decodeToMono16k(url);
    return transcribeRemote(encodeWav(pcm, 16000), pcm.length / 16000);
  }
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
): Promise<RawWord[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/transcribe", {
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
