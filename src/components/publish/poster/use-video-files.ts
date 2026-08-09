"use client";

import { useCallback, useRef, type ChangeEvent } from "react";
import { useAddVideo } from "@/hooks/use-add-video";

/**
 * Adding finished videos from disk. Owns the hidden file input so both the
 * header button and the empty state can open the same picker without either
 * of them knowing there is an input at all.
 */
export function useVideoFiles(onAdded: () => void) {
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

  const open = useCallback(() => ref.current?.click(), []);

  return { ref, state, error, onChange, open };
}
