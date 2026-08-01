/**
 * Build a StudioSource from a picked file PATH (desktop only), the native
 * counterpart to `loadVideoSource` (which works off a browser Blob). The
 * webview plays the file straight off disk via the asset protocol, and the
 * url→path mapping is registered so thumbnails and audio can reach ffmpeg.
 */

import type { StudioSource } from "@/lib/studio/types";
import { assetUrl } from "@/lib/studio/native/bridge";
import { nativeMakeProxy, nativeProbe } from "@/lib/studio/native/media";
import {
  registerNativePath,
  setNativeProxyPath,
} from "@/lib/studio/native/path-registry";

const IMAGE_SECONDS = 5;
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jfif",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "avif",
  "heic",
  "heif",
]);

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "media";
}

/** Identify still images before deciding whether a preview proxy is useful. */
export function nativeMediaKind(path: string): "image" | "video" {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return IMAGE_EXTENSIONS.has(extension) ? "image" : "video";
}

/** Load either kind of media selected from the desktop library picker. */
export async function loadNativeMediaSource(
  path: string,
): Promise<StudioSource> {
  if (nativeMediaKind(path) === "video") return loadNativeSource(path);

  // probe_media both reads the natural size and grants asset-protocol access
  // to this exact user-selected file. A still is ready after that single fast
  // probe: it never enters the video proxy/transcode pipeline.
  const probe = await nativeProbe(path);
  const url = assetUrl(path);
  registerNativePath(url, path, probe.aspect, IMAGE_SECONDS);
  return {
    url,
    nativePath: path,
    name: baseName(path),
    duration: IMAGE_SECONDS,
    width: probe.width,
    height: probe.height,
    kind: "image",
  };
}

export async function loadNativeSource(path: string): Promise<StudioSource> {
  const probe = await nativeProbe(path);
  const url = assetUrl(path);
  registerNativePath(url, path, probe.aspect, probe.duration);

  // Fire-and-forget: a low-res proxy with dense keyframes, far cheaper to
  // decode than the original for scrubbing and thumbnail extraction. Nothing
  // waits on this — the source above is already usable off the original —
  // and any failure just means the original stays in use everywhere.
  // Let the first timeline paint and its lightweight audio/thumbnail jobs get
  // a head start before the full proxy transcode begins. Starting two 4K video
  // decoders plus audio extraction at the exact same moment made import feel
  // slower even though every job was technically asynchronous.
  // Never depend on a camera-vendor sidecar such as DJI's `.LRF`. Those files
  // are optional, have vendor-specific GOP/layout choices, and do not exist for
  // iPhone or most other cameras. Every source follows the same deterministic
  // path: play the original immediately, then switch to our own dense-keyframe
  // proxy once it is ready (or immediately when it is already cached).
  window.setTimeout(() => {
    void nativeMakeProxy(path)
      .then((proxyPath) => setNativeProxyPath(url, proxyPath))
      .catch((error) =>
        console.warn("[studio] preview proxy unavailable", error),
      );
  }, 1500);

  return {
    url,
    nativePath: path,
    name: baseName(path),
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    kind: "video",
  };
}
