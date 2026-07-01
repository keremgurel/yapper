import { decodeToMono16k } from "@/lib/studio/audio-decode";

const SR = 16000;

export interface SpeechSegment {
  start: number;
  end: number;
}

export interface SilenceOptions {
  /** Minimum length of a silence to remove, in seconds. */
  minSilenceSec?: number;
  /** Keep this much audio just before speech onset (avoid clipping the first
   * phoneme), in seconds. */
  keepBeforeSec?: number;
  /** Keep this much audio after speech ends (natural decay), in seconds. */
  keepAfterSec?: number;
}

interface VadOptions {
  frameSec?: number;
  minSpeechSec?: number;
  minSilenceSec?: number;
  /** dB above the noise floor to count as speech onset (hysteresis high). */
  onDb?: number;
  /** dB above the noise floor to stay in speech (hysteresis low). */
  offDb?: number;
  /** dB above the noise floor used to back-track to the true onset. */
  onsetFloorDb?: number;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.max(
    0,
    Math.min(sortedAsc.length - 1, Math.round(p * (sortedAsc.length - 1))),
  );
  return sortedAsc[idx];
}

/** Per-frame energy in dBFS, with a tiny floor so silence isn't -Infinity. */
function frameEnergiesDb(data: Float32Array, frame: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i += frame) {
    const end = Math.min(i + frame, data.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i));
    out.push(20 * Math.log10(rms + 1e-9));
  }
  return out;
}

/**
 * Voice-activity detection: returns spoken segments in seconds. The threshold
 * adapts to the recording's own noise floor (so it works for any mic level),
 * uses hysteresis (a firm onset threshold + a lower sustain threshold so soft
 * tails aren't clipped), and back-tracks each onset to where energy first lifts
 * off the floor — which lands on the exact start of speech.
 */
export function detectSpeechSegments(
  data: Float32Array,
  {
    frameSec = 0.01,
    minSpeechSec = 0.12,
    minSilenceSec = 0.35,
    onDb = 9,
    offDb = 5,
    onsetFloorDb = 3,
  }: VadOptions = {},
): SpeechSegment[] {
  const frame = Math.max(1, Math.round(SR * frameSec));
  const db = frameEnergiesDb(data, frame);
  if (db.length === 0) return [];

  const sorted = [...db].sort((a, b) => a - b);
  const noiseFloor = percentile(sorted, 0.15);
  const peak = percentile(sorted, 0.99);
  // Too little dynamic range to distinguish speech from noise -> don't guess.
  if (peak - noiseFloor < 6) return [{ start: 0, end: db.length * frameSec }];

  const onT = noiseFloor + onDb;
  const offT = noiseFloor + offDb;
  const floorT = noiseFloor + onsetFloorDb;

  const raw: SpeechSegment[] = [];
  let inSpeech = false;
  let segStart = 0;
  for (let i = 0; i < db.length; i++) {
    if (!inSpeech) {
      if (db[i] >= onT) {
        // Back-track to the exact onset: the last frame still above the floor.
        let k = i;
        while (k > 0 && db[k - 1] > floorT) k--;
        segStart = k * frameSec;
        inSpeech = true;
      }
    } else if (db[i] < offT) {
      raw.push({ start: segStart, end: i * frameSec });
      inSpeech = false;
    }
  }
  if (inSpeech) raw.push({ start: segStart, end: db.length * frameSec });

  // Bridge gaps shorter than minSilence, then drop blips shorter than minSpeech.
  const merged: SpeechSegment[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < minSilenceSec) last.end = s.end;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.end - s.start >= minSpeechSec);
}

/**
 * Decode a media URL and return silent ranges [start, end] in seconds to cut.
 * Built on the adaptive VAD, so cuts land precisely at the edges of speech
 * (the first cut ends right before your first word). Keyless, in-browser.
 */
export async function detectSilences(
  url: string,
  {
    minSilenceSec = 0.5,
    keepBeforeSec = 0.04,
    keepAfterSec = 0.08,
  }: SilenceOptions = {},
): Promise<[number, number][]> {
  const data = await decodeToMono16k(url);
  const duration = data.length / SR;
  const segments = detectSpeechSegments(data, { minSilenceSec });
  if (segments.length === 0) return [];

  const silences: [number, number][] = [];
  let cursor = 0;
  const push = (from: number, to: number) => {
    const a = from + keepAfterSec;
    const b = to - keepBeforeSec;
    if (b - a >= minSilenceSec - keepBeforeSec - keepAfterSec && b > a) {
      silences.push([a, b]);
    }
  };
  for (const s of segments) {
    if (s.start - cursor >= minSilenceSec) push(cursor, s.start);
    cursor = Math.max(cursor, s.end);
  }
  if (duration - cursor >= minSilenceSec) push(cursor, duration);
  return silences;
}
