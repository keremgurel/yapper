"use client";

import { useCallback, useState } from "react";
import type { CaptionSet } from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption";

/**
 * Caption drafts for every video in the Poster, keyed by video then platform.
 *
 * Held one level above the editor so switching video or platform tab never
 * loses an edit, and so a batch generation can drop its results into several
 * videos at once.
 */
export function useCaptionDrafts() {
  const [byVideo, setByVideo] = useState<Record<string, CaptionSet>>({});

  const setCaption = useCallback(
    (videoId: string, caption: PlatformCaption) => {
      setByVideo((current) => ({
        ...current,
        [videoId]: { ...current[videoId], [caption.platform]: caption },
      }));
    },
    [],
  );

  const applyGenerated = useCallback(
    (videoId: string, captions: PlatformCaption[]) => {
      setByVideo((current) => {
        const merged = { ...current[videoId] };
        for (const caption of captions) merged[caption.platform] = caption;
        return { ...current, [videoId]: merged };
      });
    },
    [],
  );

  return { byVideo, setCaption, applyGenerated };
}
