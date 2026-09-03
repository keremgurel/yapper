"use client";

import { useEffect, useState } from "react";

export interface CoverMediaRef {
  submissionId?: string;
  mediaKey?: string;
}

/** A signed, playable URL for the master behind a Yapper take or an R2 key. */
export function useCoverMedia(media: CoverMediaRef): {
  url: string | null;
  error: string;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { submissionId, mediaKey } = media;

  useEffect(() => {
    let live = true;
    setUrl(null);
    setError("");
    void (async () => {
      try {
        let key = mediaKey;
        if (!key && submissionId) {
          const detail = await fetch(`/api/submissions/${submissionId}`);
          if (!detail.ok) throw new Error("video_unavailable");
          const submission = (await detail.json()) as {
            submission?: { mediaKey?: string | null };
          };
          key = submission.submission?.mediaKey ?? undefined;
        }
        if (!key) throw new Error("video_unavailable");
        const signed = await fetch(
          `/api/media/sign?key=${encodeURIComponent(key)}`,
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
  }, [submissionId, mediaKey]);

  return { url, error };
}
