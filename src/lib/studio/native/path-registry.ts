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

/**
 * Resolve one of Tauri's own `convertFileSrc` URLs even after a page/app
 * restart has cleared the in-memory registry. Tauri encodes the entire
 * absolute path as the single URL path component:
 *
 *   asset://localhost/%2FUsers%2F...%2Fclip.mp4
 *
 * Rust still canonicalizes and validates the decoded path before ffmpeg sees
 * it, so this is only a recovery mechanism for URLs the app already carries,
 * not a way around the native command's filesystem boundary.
 */
export function nativePathForUrl(url: string): string | undefined {
  const registered = byUrl.get(url)?.path;
  if (registered) return registered;
  try {
    const parsed = new URL(url);
    const isAsset =
      (parsed.protocol === "asset:" && parsed.hostname === "localhost") ||
      (parsed.protocol === "http:" && parsed.hostname === "asset.localhost");
    if (!isAsset) return undefined;
    // The custom asset:// form carries an encoded absolute path as one opaque
    // component. A plain asset://localhost/relative.mp4 URL is not proof of an
    // absolute local file and must stay rejected.
    if (
      parsed.protocol === "asset:" &&
      !/^\/%2f/i.test(parsed.pathname) &&
      !/^\/[A-Za-z]%3a/i.test(parsed.pathname)
    ) {
      return undefined;
    }
    // convertFileSrc has emitted both forms across Tauri/WebKit versions:
    //
    //   http://asset.localhost/%2FUsers%2Fme%2Fclip.mp4
    //   http://asset.localhost/Volumes/Camera/clip.mp4
    //
    // Decode before normalising the protocol's separator. Stripping the first
    // slash before decoding works for the encoded form but turns the
    // hierarchical form into a relative path ("Volumes/..."). That loses the
    // native source after a page reload, breaking both export audio and the
    // continuous edit preview.
    const decoded = decodeURIComponent(parsed.pathname);
    const path = decoded.startsWith("//")
      ? decoded.slice(1)
      : /^\/[A-Za-z]:[\\/]/.test(decoded)
        ? decoded.slice(1)
        : decoded;
    return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)
      ? path
      : undefined;
  } catch {
    return undefined;
  }
}

export function setNativeProxyPath(url: string, proxyPath: string): void {
  const media = byUrl.get(url);
  if (media) media.proxyPath = proxyPath;
}
