/**
 * Average every channel into one, keeping the native sample rate (no resample,
 * which is what preserves closely-spaced retakes for the transcriber). A single
 * channel is passed through untouched; empty input yields an empty buffer. A
 * channel shorter than the first contributes silence past its end rather than
 * throwing.
 */
export function downmixMono(channels: Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  if (ch === 1) return channels[0] ?? new Float32Array(0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) sum += channels[c][i] ?? 0;
    out[i] = sum / ch;
  }
  return out;
}
