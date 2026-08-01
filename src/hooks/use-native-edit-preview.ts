"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { assetUrl, isNative } from "@/lib/studio/native/bridge";
import {
  nativeMakeEditPreview,
  type NativeEditPreviewClip,
} from "@/lib/studio/native/media";
import {
  nativeMediaForUrl,
  nativeMediaRegistryRevision,
  nativePathForUrl,
  subscribeNativeMediaRegistry,
} from "@/lib/studio/native/path-registry";
import type { Clip, StudioSource } from "@/lib/studio/types";

// Long enough to coalesce one drag gesture, short enough that Play becomes
// available almost immediately after an edit settles.
const EDIT_PREVIEW_DEBOUNCE_MS = 100;

export function nativeEditPreviewPlan(
  clips: Clip[],
  source: Pick<StudioSource, "url" | "nativePath">,
): NativeEditPreviewClip[] | null {
  // A single source range has no cut boundary and already scrubs efficiently
  // through its dense-keyframe proxy.
  if (clips.length < 2) return null;
  const plan: NativeEditPreviewClip[] = [];
  for (const clip of clips) {
    if (clip.src?.kind === "image") return null;
    const url = clip.src?.url ?? source.url;
    const media = nativeMediaForUrl(url);
    const directPath = clip.src ? clip.src.nativePath : source.nativePath;
    const path = media?.proxyPath ?? directPath ?? nativePathForUrl(url);
    if (!path) return null;
    plan.push({
      // Prefer the lightweight proxy when it is ready. This derivative is only
      // for interactive preview; final export still reads the original.
      path,
      start: clip.start,
      end: clip.end,
    });
  }
  return plan;
}

/**
 * Build a single continuous desktop preview whenever the edit changes. The
 * old preview is dropped immediately so its stale cut can never be shown while
 * a replacement is rendering.
 */
export function useNativeEditPreview(
  clips: Clip[],
  source: StudioSource | null,
  aspect: number,
): {
  url: string | null;
  preparing: boolean;
  failed: boolean;
} {
  const [ready, setReady] = useState<{
    fingerprint: string;
    url: string | null;
    failed: boolean;
  } | null>(null);
  // Proxy generation finishes independently of React. Subscribe to that
  // external registry so a slow source-based preview is immediately replaced
  // by the fast stream-copy path as soon as the proxy becomes available.
  const mediaRevision = useSyncExternalStore(
    subscribeNativeMediaRegistry,
    nativeMediaRegistryRevision,
    nativeMediaRegistryRevision,
  );
  const fingerprint = clips
    .map(
      (clip) =>
        `${clip.src?.url ?? source?.url ?? ""}:${clip.start.toFixed(6)}:${clip.end.toFixed(6)}`,
    )
    .join("|");
  const plan = useMemo(
    () => (isNative() && source ? nativeEditPreviewPlan(clips, source) : null),
    // The fingerprint captures the range/url fields that matter. Clip object
    // identity can change during unrelated transcript/caption updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint, source, mediaRevision],
  );

  useEffect(() => {
    let cancelled = false;
    if (!plan || !Number.isFinite(aspect) || aspect <= 0) return;

    const timer = window.setTimeout(() => {
      void nativeMakeEditPreview(plan, aspect)
        .then((path) => {
          if (!cancelled) {
            setReady({
              fingerprint,
              url: assetUrl(path),
              failed: false,
            });
          }
        })
        .catch((error) => {
          // The ordinary proxy/source playback remains available as a safe
          // fallback. A failed optimization must never take down the editor.
          console.warn("Continuous edit preview unavailable", error);
          if (!cancelled) {
            setReady({ fingerprint, url: null, failed: true });
          }
        });
    }, EDIT_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plan, aspect, fingerprint]);

  if (!plan) return { url: null, preparing: false, failed: false };
  const current = ready?.fingerprint === fingerprint ? ready : null;
  return {
    url: current?.url ?? null,
    preparing: !current,
    failed: current?.failed ?? false,
  };
}
