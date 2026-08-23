"use client";

import { useEffect, useState } from "react";
import { fetchPreview, type BrainPreview } from "@/lib/brain/preview-client";
import type { BrainSurface } from "@/lib/db/schema";

/**
 * What the AI reads, kept in step with the page.
 *
 * `version` is the handle the page turns after an edit. It is a number rather
 * than a dependency on the sections themselves because the compiled text
 * depends on the server's view, not the browser's: a digest the creator is
 * still typing has not changed what any prompt would read yet.
 *
 * Refetches are debounced and the previous one is aborted, so holding a key
 * down in a section does not queue twenty compilations.
 */
export function useBrainPreview(
  surface: BrainSurface,
  version: number,
): { preview: BrainPreview | null; loading: boolean; error: boolean } {
  const [preview, setPreview] = useState<BrainPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchPreview(surface, "", controller.signal).then(
        (next) => {
          setPreview(next);
          setError(false);
          setLoading(false);
        },
        (cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(true);
          setLoading(false);
          console.error("[brain/preview] failed", cause);
        },
      );
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [surface, version]);

  return { preview, loading, error };
}
