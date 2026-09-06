"use client";

import { useRef, useState } from "react";
import { patchContent } from "@/lib/content/client";
import {
  invalidateClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import { createTakeSaver, type SaveTakeError } from "@/lib/studio/save-take";

export type SaveTakeState = "idle" | "saving" | "saved" | "error";
export type { SaveTakeError } from "@/lib/studio/save-take";

/** Keep one retryable upload pipeline for the current review screen. */
export function useSaveTake(itemId: string | null) {
  const [state, setState] = useState<SaveTakeState>("idle");
  const [error, setError] = useState<SaveTakeError | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const running = useRef(false);
  const [saveTake] = useState(() =>
    createTakeSaver({
      link: async (id, submissionId) => {
        await patchContent(id, { submissionId });
      },
    }),
  );

  const save = async (blob: Blob, title?: string) => {
    if (running.current || state === "saved") return;
    running.current = true;
    setState("saving");
    setError(null);
    try {
      const id = await saveTake(itemId, blob, title);
      setSavedItemId(id);
      for (const key of [
        STUDIO_RESOURCE_KEYS.ideas,
        STUDIO_RESOURCE_KEYS.content,
        STUDIO_RESOURCE_KEYS.posterContent,
      ])
        invalidateClientResource(key);
      setState("saved");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "failed";
      setError(
        message === "locked" ||
          message === "storage_full" ||
          message === "too_large" ||
          message === "unavailable"
          ? message
          : "failed",
      );
      setState("error");
    } finally {
      running.current = false;
    }
  };
  return { state, error, save, savedItemId };
}
