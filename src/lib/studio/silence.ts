export interface SilenceOptions {
  /** RMS amplitude (0-1) below which a window counts as silent. */
  threshold?: number;
  /** Minimum length of a silence to remove, in seconds. */
  minSilenceSec?: number;
  /** Keep this much speech padding on each side of a cut, in seconds. */
  padSec?: number;
}

/**
 * Decode the audio of a media URL and return silent ranges [start, end] in
 * seconds. Runs entirely in the browser via Web Audio — no upload, no key.
 */
export async function detectSilences(
  url: string,
  {
    threshold = 0.015,
    minSilenceSec = 0.5,
    padSec = 0.08,
  }: SilenceOptions = {},
): Promise<[number, number][]> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    const win = Math.max(1, Math.floor(sr * 0.02)); // 20ms windows

    const ranges: [number, number][] = [];
    let silentStart = -1;

    for (let i = 0; i < data.length; i += win) {
      let sumSq = 0;
      const end = Math.min(i + win, data.length);
      for (let j = i; j < end; j++) sumSq += data[j] * data[j];
      const rms = Math.sqrt(sumSq / (end - i));
      const tStart = i / sr;

      if (rms < threshold) {
        if (silentStart < 0) silentStart = tStart;
      } else if (silentStart >= 0) {
        pushRange(ranges, silentStart, tStart, minSilenceSec, padSec);
        silentStart = -1;
      }
    }
    if (silentStart >= 0) {
      pushRange(ranges, silentStart, data.length / sr, minSilenceSec, padSec);
    }
    return ranges;
  } finally {
    void ctx.close();
  }
}

function pushRange(
  ranges: [number, number][],
  start: number,
  end: number,
  minSilenceSec: number,
  padSec: number,
): void {
  if (end - start < minSilenceSec) return;
  const from = start + padSec;
  const to = end - padSec;
  if (to > from) ranges.push([from, to]);
}
