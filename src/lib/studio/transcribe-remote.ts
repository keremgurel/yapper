import { encodeWav } from "@/lib/studio/wav";

export interface RawWord {
  text: string;
  start: number;
  end: number;
}

/**
 * Transcribe via the backend (/api/transcribe), which uses a hosted model
 * (Deepgram, our transcriber of record). Sends a small 16 kHz WAV and returns
 * word-level timings.
 *
 * There is no on-device fallback: hosted transcription is the only path, so any
 * failure is surfaced rather than silently downgraded. A transient failure
 * (network blip, 5xx) is retried once; a missing provider (HTTP 501) or a
 * persistent error throws so the caller can show an error and let the user
 * retry, instead of producing a quietly worse transcript.
 */
export async function transcribeRemote(
  audio: Float32Array,
  sampleRate = 16000,
): Promise<RawWord[]> {
  const wav = encodeWav(audio, sampleRate);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      if (res.status === 501) {
        throw new Error("transcribe_no_provider");
      }
      if (!res.ok) throw new Error(`remote_transcribe_${res.status}`);
      const data = (await res.json()) as { words?: RawWord[] };
      return data.words ?? [];
    } catch (e) {
      lastErr = e;
      // A missing provider won't fix itself on retry — fail fast.
      if (e instanceof Error && e.message === "transcribe_no_provider") throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("remote_transcribe");
}
