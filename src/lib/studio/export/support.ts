/** Whether the browser has the WebCodecs + muxing APIs the exporter needs. */
export function isWebCodecsExportSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.VideoEncoder === "function" &&
    typeof window.VideoFrame === "function" &&
    typeof window.AudioEncoder === "function" &&
    typeof window.OfflineAudioContext === "function"
  );
}

/**
 * Pick a supported H.264 codec string for the given frame size. Tries ascending
 * levels (4.0 up to 6.2) so large frames like 4K portrait find an encoder, and
 * within each level prefers High profile for quality, then Main, then Baseline.
 * The first level the encoder accepts wins (the lowest sufficient level, which
 * is the most broadly playable). Returns null if nothing encodes at this size.
 *
 * Codec string is avc1.PPCCLL: PP profile (High 64, Main 4D, Baseline 42E0-ish),
 * LL the level in hex. A 1080p frame lands on level 4.x; 4K needs level 5.1+.
 */
export async function pickAvcCodec(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<string | null> {
  // Levels: 4.0, 4.2, 5.0, 5.1, 5.2, 6.0, 6.1, 6.2 (hex).
  const levels = ["28", "2A", "32", "33", "34", "3C", "3D", "3E"];
  // Profile prefixes: High, Main, Constrained Baseline.
  const profiles = ["6400", "4D00", "42E0"];
  for (const level of levels) {
    for (const profile of profiles) {
      const codec = `avc1.${profile}${level}`;
      try {
        const { supported } = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate,
          framerate,
        });
        if (supported) return codec;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return null;
}
