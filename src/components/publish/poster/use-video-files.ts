"use client";

import { useCallback, useRef, type ChangeEvent } from "react";
import { useAddVideo } from "@/hooks/use-add-video";
import type { ContentDetail } from "@/lib/content/client";

/**
 * Adding finished videos from disk, by picker or by drop.
 *
 * The created item is handed back rather than swallowed, so the caller can put
 * the creator straight into composing the thing they just dropped instead of
 * making them find it again in a grid.
 */
export function useVideoFiles(onAdded: (item: ContentDetail) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const { state, error, add } = useAddVideo(onAdded);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) {
        // Sequential: each upload streams a whole video, and running a dropped
        // batch in parallel is how a slow connection stalls all of them.
        void (async () => {
          for (const file of files) await add(file);
        })();
      }
      event.target.value = "";
    },
    [add],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      void (async () => {
        for (const file of files) await add(file);
      })();
    },
    [add],
  );

  const open = useCallback(() => ref.current?.click(), []);

  return { ref, state, error, onChange, addFiles, open };
}
