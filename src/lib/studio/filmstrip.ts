export interface Frame {
  time: number; // source seconds
  src: string; // data URL
}

export interface Filmstrip {
  frames: Frame[];
  aspect: number; // frame width / height, for sizing tiles
}

export const EMPTY_FILMSTRIP: Filmstrip = { frames: [], aspect: 16 / 9 };

/**
 * Generate evenly-spaced thumbnail frames from a video URL, entirely in-browser
 * (offscreen <video> + <canvas>). Frames stream out through `onProgress` as they
 * are captured. Density scales with duration so a windowed (tiled) timeline can
 * show distinct frames when zoomed in instead of stretching a few thumbnails.
 * Resolves without throwing on failure, so a caller can fall back to plain
 * blocks. Poll `cancelled` to abandon a strip that is no longer wanted.
 */
export function generateFilmstrip(
  url: string,
  duration: number,
  onProgress: (strip: Filmstrip) => void,
  cancelled: () => boolean,
): Promise<void> {
  if (!url || !Number.isFinite(duration) || duration <= 0) {
    return Promise.resolve();
  }

  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";

  const seek = (t: number) =>
    new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
    });

  const capture = async () => {
    // ~1.5 frames/sec keeps zoomed-in tiles distinct without too many seeks.
    const n = Math.min(120, Math.max(12, Math.round(duration * 1.5)));
    const aspect =
      video.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : 16 / 9;
    const h = 72;
    const w = Math.round(h * aspect);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frames: Frame[] = [];
    for (let i = 0; i < n; i++) {
      if (cancelled()) return;
      const t = ((i + 0.5) * duration) / n;
      try {
        await seek(t);
        ctx.drawImage(video, 0, 0, w, h);
        frames.push({ time: t, src: canvas.toDataURL("image/jpeg", 0.6) });
        if (!cancelled()) onProgress({ frames: [...frames], aspect });
      } catch {
        // skip this frame
      }
    }
  };

  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeAttribute("src");
      video.load();
      resolve();
    };
    video.addEventListener("error", done, { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        void capture().then(done, done);
      },
      { once: true },
    );
  });
}

/**
 * Scale peaks into 0..1 by the loudest one, with a floor so a near-silent clip
 * doesn't divide by ~0 and blow up into a wall of ones. Uses a plain loop, NOT
 * `Math.max(0.01, ...peaks)`: a long clip produces tens of thousands of buckets,
 * and spreading that many arguments overflows the engine's argument limit and
 * throws on some browsers (which then silently drops the whole waveform).
 */
export function normalizePeaks(peaks: number[]): number[] {
  let peak = 0.01;
  for (const v of peaks) if (v > peak) peak = v;
  return peaks.map((v) => v / peak);
}

/**
 * Decode a media URL's audio into normalized peak amplitudes (0–1) spanning its
 * full duration, so a timeline can draw a waveform aligned to it. Resolves to []
 * when there is no audio track or the bytes can't be decoded.
 */
export async function generateWaveform(
  url: string,
  duration: number,
): Promise<number[]> {
  if (!url || !Number.isFinite(duration) || duration <= 0) return [];
  // ~120 peaks/sec keeps the waveform precise even at deep zoom.
  const buckets = Math.min(30000, Math.max(600, Math.round(duration * 120)));
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const bytes = await (await fetch(url)).arrayBuffer();
    const audio = await ctx.decodeAudioData(bytes);
    const data = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / buckets));
    const out: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      const s = i * block;
      const e = Math.min(s + block, data.length);
      for (let j = s; j < e; j++) {
        const a = Math.abs(data[j]);
        if (a > max) max = a;
      }
      out.push(max);
    }
    return normalizePeaks(out);
  } catch {
    return []; // no audio track / decode failure
  } finally {
    void ctx.close();
  }
}
