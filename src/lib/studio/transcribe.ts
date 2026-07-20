import { detectSpeechSegments } from "@/lib/studio/silence";
import { transcribeUrl } from "@/lib/studio/transcribe-remote";
import { refineWordTimings } from "@/lib/studio/transcript-edit";
import { newWordId, type Word } from "@/lib/studio/types";
import {
  applyTranscriptionDictionary,
  type TranscriptionDictionaryEntry,
} from "@/lib/studio/transcription-dictionary";

/**
 * Decoded audio plus its source url, in: timed words, out.
 *
 * The backend transcribes the ORIGINAL native-rate media at `url`, never the
 * 16 kHz PCM. Resampling to 16 kHz merges repeated takes, and the transcript
 * then silently drops the retakes. The decoded audio is only used locally, to
 * refine each word's edges against the VAD's speech segments.
 *
 * There is no on-device fallback: it was markedly less accurate in exactly the
 * same way, so a failure throws rather than quietly downgrading the transcript.
 */
export async function transcribeToWords(
  audio: Float32Array,
  url: string,
  dictionary: TranscriptionDictionaryEntry[] = [],
): Promise<Word[]> {
  const raw = applyTranscriptionDictionary(
    await transcribeUrl(url, dictionary),
    dictionary,
  );
  const segments = detectSpeechSegments(audio);
  return refineWordTimings(
    raw.map((w, i) => ({ id: newWordId(i), ...w })),
    segments,
  );
}
