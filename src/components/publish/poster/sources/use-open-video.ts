"use client";

import { useCallback, useRef, useState } from "react";
import { importInstagramMedia } from "@/lib/publish/client";
import { importFailureMessage } from "@/lib/publish/import-failure";
import { canOpen, type PosterVideo } from "../poster-video";

/** Open immediately; prepare the reusable master without blocking composition. */
export function useOpenVideo() {
  const [active, setActive] = useState<PosterVideo | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const imports = useRef(
    new Map<string, ReturnType<typeof importInstagramMedia>>(),
  );

  const open = useCallback(async (video: PosterVideo) => {
    if (!canOpen(video)) return;
    const request = ++generation.current;
    setError("");
    setActive(
      video.kind === "platform" ? { ...video, mediaKey: undefined } : video,
    );
    setImportingId(null);
    if (video.kind === "yapper") return;
    setImportingId(video.id);
    try {
      if (video.mediaKey) {
        const response = await fetch(
          `/api/media/sign?key=${encodeURIComponent(video.mediaKey)}`,
        );
        if (response.ok) {
          const { url } = (await response.json()) as { url?: string };
          if (request === generation.current)
            setActive({ ...video, previewUrl: url });
          return;
        }
        if (video.platform !== "instagram") throw new Error("no_source_file");
        if (request === generation.current)
          setActive({ ...video, mediaKey: undefined });
      }
      let pending = imports.current.get(video.id);
      if (!pending) {
        pending = importInstagramMedia(video.sourceId);
        imports.current.set(video.id, pending);
      }
      const imported = await pending;
      if (request === generation.current)
        setActive({
          ...video,
          mediaKey: imported.mediaKey,
          previewUrl: undefined,
          title: imported.title || video.title,
        });
    } catch (cause) {
      if (request === generation.current)
        setError(
          importFailureMessage(
            cause instanceof Error ? cause.message : undefined,
          ),
        );
    } finally {
      imports.current.delete(video.id);
      if (request === generation.current) setImportingId(null);
    }
  }, []);

  const close = useCallback(() => {
    generation.current++;
    setActive(null);
    setImportingId(null);
    setError("");
  }, []);
  return { active, importingId, error, open, close, setActive };
}
