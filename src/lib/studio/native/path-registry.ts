/**
 * Maps the webview asset URL a clip carries (`assetUrl(path)`) back to the
 * original file on disk plus its aspect, so downstream media work (native
 * thumbnails, native audio extraction) can reach ffmpeg without threading
 * `path` through every Clip/TimelineMedia/Overlay type.
 *
 * `assetUrl()` is deterministic for a given path, so the same file always keys
 * to the same URL. Purely additive: on the web nothing registers and every
 * lookup returns undefined.
 *
 * Also holds the (optional, filled in asynchronously) low-res proxy for that
 * same file: a fast H.264 transcode with dense keyframes, cheap to decode for
 * playback compared to a 4K HEVC original. A caller reads `proxyPath`
 * opportunistically (use it if it's already there, fall back to `path`
 * otherwise) rather than waiting for it — the transcode itself can take
 * longer than just decoding the original, so blocking on it defeats the
 * purpose.
 */

interface NativeMedia {
  path: string;
  aspect: number; // width / height, for filmstrip tile sizing
  duration: number; // seconds, so the transcribe request can flag truncation
  proxyPath?: string;
}

const byUrl = new Map<string, NativeMedia>();

export function registerNativePath(
  url: string,
  path: string,
  aspect: number,
  duration: number,
): void {
  byUrl.set(url, { path, aspect, duration });
}

export function nativeMediaForUrl(url: string): NativeMedia | undefined {
  return byUrl.get(url);
}

export function setNativeProxyPath(url: string, proxyPath: string): void {
  const media = byUrl.get(url);
  if (media) media.proxyPath = proxyPath;
}
