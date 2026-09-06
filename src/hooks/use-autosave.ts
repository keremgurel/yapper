"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SaveQueue,
  type MergeFields,
  type SaveFunction,
  type SaveOptions,
  type SaveState,
} from "@/lib/save-queue";

export type { SaveState } from "@/lib/save-queue";

/** Debounce edits, serialize writes, retain failed changes, and flush on exit. */
export function useAutosave<T extends object>(
  save: SaveFunction<T>,
  debounceMs = 800,
  merge?: MergeFields<T>,
) {
  const [state, setState] = useState<SaveState>("idle");
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [engine] = useState(() => new SaveQueue<T>(setState, merge));

  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    engine.setListener(setState);
    return () => {
      engine.setListener(() => {});
    };
  }, [engine]);

  const flush = useCallback(
    (options?: SaveOptions) => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      return engine.settle(options);
    },
    [engine],
  );

  const queue = useCallback(
    (fields: Partial<T>) => {
      engine.enqueue(fields, saveRef.current);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush().catch(() => {});
      }, debounceMs);
    },
    [engine, flush, debounceMs],
  );

  const unsent = useCallback(() => engine.unsent(), [engine]);

  useEffect(() => {
    const onPageHide = () => {
      void flush({ keepalive: true }).catch(() => {});
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void flush({ keepalive: true }).catch(() => {});
    };
  }, [flush]);

  return { state, queue, flush, unsent };
}
