export interface PooledMedia {
  kind: "video" | "image";
  el: HTMLVideoElement | HTMLImageElement;
  naturalW: number;
  naturalH: number;
  /** Seek a video to `t` seconds and resolve once that frame is ready. No-op
   * for images. */
  seek: (t: number) => Promise<void>;
}

const SEEK_EPSILON = 1 / 120; // ~half a frame at 60fps

function isRemote(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function loadVideo(url: string): Promise<PooledMedia> {
  const el = document.createElement("video");
  // Anonymous CORS is required so the canvas stays untainted; blob/same-origin
  // URLs are unaffected, but remote (R2) URLs need CORS headers to be set.
  if (isRemote(url)) el.crossOrigin = "anonymous";
  el.src = url;
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    el.onloadeddata = () => resolve();
    el.onerror = () =>
      reject(new Error(`Could not load video source (${url.slice(0, 48)}…)`));
  });

  const duration = Number.isFinite(el.duration) ? el.duration : 0;
  const vfc = el as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
  };

  // Wait until the seeked frame is actually presented before drawing it, not
  // merely until 'seeked' fires — in Chromium the event can precede the frame
  // reaching the compositor, so drawImage would capture the PREVIOUS frame.
  const awaitPresented = (resolve: () => void) => {
    if (typeof vfc.requestVideoFrameCallback !== "function") {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    vfc.requestVideoFrameCallback(finish);
    // Fallback: rVFC may not fire for a paused element on some builds.
    setTimeout(finish, 100);
  };

  let lastRequested = -1;
  const seek = (t: number) =>
    new Promise<void>((resolve) => {
      const clamped =
        duration > 0 ? Math.min(t, Math.max(0, duration - SEEK_EPSILON)) : t;
      // Skip only when we already asked for (approximately) this exact target;
      // comparing the browser-snapped currentTime could skip a distinct frame.
      if (Math.abs(lastRequested - clamped) < SEEK_EPSILON) {
        resolve();
        return;
      }
      lastRequested = clamped;
      // Already sitting on this frame (notably the first frame at t=0 on a fresh
      // video): assigning currentTime its current value may not fire 'seeked' at
      // all (WebKit especially), which would hang the export forever. Present the
      // current frame instead of waiting for an event that never comes.
      if (Math.abs(el.currentTime - clamped) < SEEK_EPSILON) {
        awaitPresented(resolve);
        return;
      }
      const onSeeked = () => {
        el.removeEventListener("seeked", onSeeked);
        awaitPresented(resolve);
      };
      el.addEventListener("seeked", onSeeked);
      el.currentTime = clamped;
    });

  return {
    kind: "video",
    el,
    naturalW: el.videoWidth,
    naturalH: el.videoHeight,
    seek,
  };
}

async function loadImage(url: string): Promise<PooledMedia> {
  const el = document.createElement("img");
  if (isRemote(url)) el.crossOrigin = "anonymous";
  el.src = url;
  await el.decode();
  return {
    kind: "image",
    el,
    naturalW: el.naturalWidth,
    naturalH: el.naturalHeight,
    seek: async () => {},
  };
}

/**
 * Loads and caches media elements keyed by a caller-chosen string. The key
 * (not the URL) is the identity, so the base track and an overlay that happen to
 * reuse the same recording each get their own element and never fight over
 * seek position within a single frame.
 */
export class MediaPool {
  private items = new Map<string, PooledMedia>();

  async load(
    key: string,
    url: string,
    kind: "video" | "image",
  ): Promise<PooledMedia> {
    const existing = this.items.get(key);
    if (existing) return existing;
    const media =
      kind === "image" ? await loadImage(url) : await loadVideo(url);
    this.items.set(key, media);
    return media;
  }

  get(key: string): PooledMedia | undefined {
    return this.items.get(key);
  }

  destroy(): void {
    for (const media of this.items.values()) {
      if (media.kind === "video") {
        const v = media.el as HTMLVideoElement;
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    }
    this.items.clear();
  }
}
