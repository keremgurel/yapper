"use client";

import { useEffect, useMemo, useState } from "react";
import { assetUrl, isNative } from "@/lib/studio/native/bridge";
import {
  nativeMakeEditPreview,
  type NativeEditPreviewClip,
} from "@/lib/studio/native/media";
import { nativeMediaForUrl } from "@/lib/studio/native/path-registry";
import type { Clip } from "@/lib/studio/types";

const EDIT_PREVIEW_DEBOUNCE_MS = 300;

export function nativeEditPreviewPlan(
  clips: Clip[],
  baseUrl: string,
): NativeEditPreviewClip[] | null {
  // A single source range has no cut boundary and already scrubs efficiently
  // through its dense-keyframe proxy.
  if (clips.length < 2) return null;
  const plan: NativeEditPreviewClip[] = [];
  for (const clip of clips) {
    if (clip.src?.kind === "image") return null;
    const url = clip.src?.url ?? baseUrl;
    const media = nativeMediaForUrl(url);
    if (!media) return null;
    plan.push({
      // Prefer the lightweight proxy when it is ready. This derivative is only
      // for interactive preview; final export still reads the original.
      path: media.proxyPath ?? media.path,
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
  baseUrl: string,
  aspect: number,
): string | null {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fingerprint = clips
    .map(
      (clip) =>
        `${clip.src?.url ?? baseUrl}:${clip.start.toFixed(6)}:${clip.end.toFixed(6)}`,
    )
    .join("|");
  const plan = useMemo(
    () => (isNative() ? nativeEditPreviewPlan(clips, baseUrl) : null),
    // The fingerprint captures the range/url fields that matter. Clip object
    // identity can change during unrelated transcript/caption updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint, baseUrl],
  );

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    if (!plan || !Number.isFinite(aspect) || aspect <= 0) return;

    const timer = window.setTimeout(() => {
      void nativeMakeEditPreview(plan, aspect)
        .then((path) => {
          if (!cancelled) setPreviewUrl(assetUrl(path));
        })
        .catch((error) => {
          // The ordinary proxy/source playback remains available as a safe
          // fallback. A failed optimization must never take down the editor.
          console.warn("Continuous edit preview unavailable", error);
        });
    }, EDIT_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plan, aspect]);

  return previewUrl;
}
