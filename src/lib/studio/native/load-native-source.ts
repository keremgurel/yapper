/**
 * Build a StudioSource from a picked file PATH (desktop only), the native
 * counterpart to `loadVideoSource` (which works off a browser Blob). The
 * webview plays the file straight off disk via the asset protocol, and the
 * url→path mapping is registered so thumbnails and audio can reach ffmpeg.
 */

import type { StudioSource } from "@/lib/studio/types";
import { assetUrl } from "@/lib/studio/native/bridge";
import {
  nativeCompanionProxy,
  nativeMakeProxy,
  nativeProbe,
} from "@/lib/studio/native/media";
import {
  registerNativePath,
  setNativeProxyPath,
} from "@/lib/studio/native/path-registry";

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "video";
}

export async function loadNativeSource(path: string): Promise<StudioSource> {
  const probe = await nativeProbe(path);
  const url = assetUrl(path);
  registerNativePath(url, path, probe.aspect, probe.duration);

  const companion = await nativeCompanionProxy(path);
  if (companion) {
    setNativeProxyPath(url, companion);
  }

  // Fire-and-forget: a low-res proxy with dense keyframes, far cheaper to
  // decode than the original for scrubbing and thumbnail extraction. Nothing
  // waits on this — the source above is already usable off the original —
  // and any failure just means the original stays in use everywhere.
  // Let the first timeline paint and its lightweight audio/thumbnail jobs get
  // a head start before the full proxy transcode begins. Starting two 4K video
  // decoders plus audio extraction at the exact same moment made import feel
  // slower even though every job was technically asynchronous.
  if (!companion) {
    window.setTimeout(() => {
      void nativeMakeProxy(path)
        .then((proxyPath) => setNativeProxyPath(url, proxyPath))
        .catch((error) =>
          console.warn("[studio] preview proxy unavailable", error),
        );
    }, 1500);
  }

  return {
    url,
    name: baseName(path),
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    kind: "video",
  };
}
