/**
 * How a practice rep sounded, as opposed to what was said: how accurately the
 * sounds were produced, how smoothly the words ran together, and how much the
 * voice moved. Measured from the audio by Azure Speech, because none of it
 * survives transcription.
 */
export interface PronunciationReport {
  /** 0-100. How close each sound was to a clear, standard production. */
  accuracy: number;
  /** 0-100. Smoothness: natural breaks between words, no stalls inside them. */
  fluency: number;
  /** 0-100. Intonation, rhythm and stress. Null when it was not measured. */
  prosody: number | null;
  /** 0-100. Share of words said in a flat pitch. */
  monotoneShare: number;
  /** Seconds of audio the scores are based on. */
  assessedSeconds: number;
  /** The least clear words, worst first. */
  words: UnclearWord[];
}

export interface UnclearWord {
  text: string;
  /** 0-100 for the whole word. */
  accuracy: number;
  /** Seconds into the recording. */
  start: number;
  /** The weakest sound in the word, in Azure's phoneme alphabet. */
  sound: string | null;
}

/** Only this much of a rep is assessed, which bounds both cost and wait. The
 * service works through audio at about twice real time, so this finishes
 * around when the coaching request does. */
export const MAX_ASSESSED_SECONDS = 90;
/** A word below this is worth showing to the speaker. */
export const UNCLEAR_BELOW = 70;
export const MAX_UNCLEAR_WORDS = 10;
