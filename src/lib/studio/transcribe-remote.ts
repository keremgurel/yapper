import type { RawWord } from "@/lib/studio/transcribe";
import { encodeWav } from "@/lib/studio/wav";

/**
 * Transcribe via the backend (/api/transcribe) using a hosted model. Sends a
 * small 16 kHz WAV. Returns null when the backend has no provider configured
 * (HTTP 501) so the caller can fall back to on-device transcription.
 */
export async function transcribeRemote(
  audio: Float32Array,
  sampleRate = 16000,
): Promise<RawWord[] | null> {
  const wav = encodeWav(audio, sampleRate);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: wav,
  });
  if (res.status === 501) return null;
  if (!res.ok) throw new Error(`remote_transcribe_${res.status}`);
  const data = (await res.json()) as { words?: RawWord[] };
  return data.words ?? [];
}
