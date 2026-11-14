"use client";

import { useEffect, useState } from "react";

export interface PublishPreview {
  url: string;
  duration: number;
}

/**
 * A playable address and the length of the video about to be posted. A video
 * that is still uploading has neither id yet, so it stays loading until one
 * arrives instead of reporting a failure.
 */
export function usePublishPreview(
  submissionId?: string,
  mediaKey?: string,
): { preview: PublishPreview | null; failed: boolean } {
  const source = `${submissionId ?? ""}|${mediaKey ?? ""}`;
  const [result, setResult] = useState<{
    source: string;
    preview: PublishPreview | null;
  } | null>(null);

  useEffect(() => {
    if (!submissionId && !mediaKey) return;
    const controller = new AbortController();
    fetch("/api/publish/preview", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, mediaKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("preview_unavailable");
        return (await response.json()) as PublishPreview;
      })
      .then((preview) => setResult({ source, preview }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ source, preview: null });
      });
    return () => controller.abort();
  }, [source, submissionId, mediaKey]);

  // An answer for an earlier video says nothing about this one.
  const current = result?.source === source ? result : null;
  return {
    preview: current?.preview ?? null,
    failed: current !== null && current.preview === null,
  };
}
