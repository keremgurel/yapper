"use client";

import { useCallback, useEffect, useState } from "react";

export interface CoverMediaRef {
  submissionId?: string;
  mediaKey?: string;
  previewUrl?: string;
}

/** A signed, playable URL for the master behind a Yapper take or an R2 key. */
export function useCoverMedia(media: CoverMediaRef): {
  url: string | null;
  error: string;
  retry: () => void;
} {
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { submissionId, mediaKey, previewUrl } = media;

  useEffect(() => {
    let live = true;
    const direct =
      previewUrl &&
      (revision === 0 ||
        previewUrl.startsWith("blob:") ||
        (!submissionId && !mediaKey))
        ? previewUrl
        : null;
    setUrl(direct);
    setError("");
    if (direct || (!submissionId && !mediaKey)) return;
    void (async () => {
      try {
        let key = mediaKey;
        if (!key && submissionId) {
          const detail = await fetch(`/api/submissions/${submissionId}`, {
            signal: AbortSignal.timeout(15_000),
          });
          if (!detail.ok) throw new Error("video_unavailable");
          const submission = (await detail.json()) as {
            submission?: { mediaKey?: string | null };
          };
          key = submission.submission?.mediaKey ?? undefined;
        }
        if (!key) throw new Error("video_unavailable");
        const signed = await fetch(
          `/api/media/sign?key=${encodeURIComponent(key)}`,
          { signal: AbortSignal.timeout(15_000) },
        );
        if (!signed.ok) throw new Error("video_unavailable");
        const { url: signedUrl } = (await signed.json()) as { url?: string };
        if (!signedUrl) throw new Error("video_unavailable");
        if (live) setUrl(signedUrl);
      } catch {
        if (live) setError("The video preview could not be loaded.");
      }
    })();
    return () => {
      live = false;
    };
  }, [submissionId, mediaKey, previewUrl, revision]);

  return { url, error, retry };
}
