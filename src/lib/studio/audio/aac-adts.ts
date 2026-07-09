import type { DemuxedAudio } from "@/lib/studio/audio/demux-audio";

// MPEG-4 sampling-frequency index table (ADTS header field).
const RATE_INDEX: Record<number, number> = {
  96000: 0,
  88200: 1,
  64000: 2,
  48000: 3,
  44100: 4,
  32000: 5,
  24000: 6,
  22050: 7,
  16000: 8,
  12000: 9,
  11025: 10,
  8000: 11,
  7350: 12,
};

/**
 * Wrap demuxed AAC frames in ADTS headers to produce a self-contained `.aac`
 * byte stream. This lets us hand the transcriber the ORIGINAL, native-rate audio
 * with no decode and no resample. That matters: resampling to 16 kHz in the
 * browser (via OfflineAudioContext) subtly smears closely-spaced retakes so the
 * ASR merges them, dropping words. The original AAC keeps every word.
 *
 * Returns null when the track isn't AAC-LC (the only codec ADTS frames here
 * describe), so the caller can fall back to a decoded-PCM path.
 */
export function aacToAdts(demuxed: DemuxedAudio): Uint8Array | null {
  if (!/mp4a\.40/.test(demuxed.codec)) return null;
  const freqIdx = RATE_INDEX[demuxed.sampleRate];
  if (freqIdx === undefined) return null;
  const chanCfg = demuxed.numberOfChannels;
  if (chanCfg < 1 || chanCfg > 7) return null;

  // AAC object type from the AudioSpecificConfig (top 5 bits); ADTS profile is
  // that minus one. Default to AAC-LC (object type 2 → profile 1).
  const objectType = demuxed.description ? demuxed.description[0] >> 3 : 2;
  const profile = Math.max(0, objectType - 1) & 0x3;

  const total = demuxed.chunks.reduce((n, c) => n + 7 + c.data.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of demuxed.chunks) {
    const frameLen = 7 + chunk.data.length;
    out[pos] = 0xff;
    out[pos + 1] = 0xf1; // syncword tail, MPEG-4, layer 0, no CRC
    out[pos + 2] = (profile << 6) | (freqIdx << 2) | ((chanCfg >> 2) & 0x1);
    out[pos + 3] = ((chanCfg & 0x3) << 6) | ((frameLen >> 11) & 0x3);
    out[pos + 4] = (frameLen >> 3) & 0xff;
    out[pos + 5] = ((frameLen & 0x7) << 5) | 0x1f; // + buffer fullness high
    out[pos + 6] = 0xfc; // buffer fullness low + 1 frame per ADTS packet
    out.set(chunk.data, pos + 7);
    pos += frameLen;
  }
  return out;
}
