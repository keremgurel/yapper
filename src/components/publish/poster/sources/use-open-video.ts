"use client";

import { useCallback, useState } from "react";
import { importInstagramMedia } from "@/lib/publish/client";
import { importFailureMessage } from "@/lib/publish/import-failure";
import { canOpen, type PosterVideo } from "../poster-video";

/**
 * Which video is on the bench. Opening a channel post that Yapper has no file
 * for imports it first (Instagram), so the same click that opens a Yapper
 * take also opens a Reel, just a few seconds later.
 */
export function useOpenVideo() {
  const [active, setActive] = useState<PosterVideo | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const open = useCallback(async (video: PosterVideo) => {
    setError("");
    if (!canOpen(video)) return;
    if (video.kind === "yapper" || video.mediaKey) {
      setActive(video);
      return;
    }
    setImportingId(video.id);
    try {
      const imported = await importInstagramMedia(video.sourceId);
      setActive({
        ...video,
        mediaKey: imported.mediaKey,
        title: imported.title || video.title,
      });
    } catch (cause) {
      setError(
        importFailureMessage(
          cause instanceof Error ? cause.message : undefined,
        ),
      );
    } finally {
      setImportingId(null);
    }
  }, []);

  const close = useCallback(() => setActive(null), []);

  return { active, importingId, error, open, close, setActive };
}
