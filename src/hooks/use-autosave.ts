"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveOpts {
  keepalive?: boolean;
}

/**
 * A debounced, serialized save queue for autosaving a form to the server.
 * One concern: collect dirty fields, save them in order, never overlap.
 *
 * - queue(fields) merges into the pending dirty set and (re)arms the debounce.
 * - Saves are chained on one promise, so a slow response can never land after
 *   (and clobber) a newer one.
 * - Failed saves re-merge their fields into pending (newer edits win), so the
 *   next edit retries them.
 * - On unmount and on pagehide, pending fields flush immediately; pagehide uses
 *   keepalive so the request survives a hard navigation.
 */
export function useAutosave<T extends object>(
  save: (dirty: Partial<T>, opts?: SaveOpts) => Promise<void>,
  debounceMs = 800,
) {
  const [state, setState] = useState<SaveState>("idle");
  const pendingRef = useRef<Partial<T>>({});
  const timerRef = useRef<number | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const set = (s: SaveState) => {
    if (mountedRef.current) setState(s);
  };

  const flush = useCallback((opts?: SaveOpts): Promise<void> => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const dirty = pendingRef.current;
    if (Object.keys(dirty).length === 0) return chainRef.current;
    pendingRef.current = {};
    set("saving");
    chainRef.current = chainRef.current
      .then(() => saveRef.current(dirty, opts))
      .then(
        () => {
          // Only report saved if nothing new queued up meanwhile.
          if (Object.keys(pendingRef.current).length === 0) set("saved");
        },
        () => {
          // Newer pending edits win over the failed payload's values.
          pendingRef.current = { ...dirty, ...pendingRef.current };
          set("error");
        },
      );
    return chainRef.current;
  }, []);

  const queue = useCallback(
    (fields: Partial<T>) => {
      Object.assign(pendingRef.current, fields);
      set("saving");
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void flush(), debounceMs);
    },
    [flush, debounceMs],
  );

  // Flush on hard navigation (keepalive) and on unmount (SPA nav keeps JS
  // alive, so a normal fetch is fine there).
  useEffect(() => {
    const onPageHide = () => void flush({ keepalive: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, [flush]);

  return { state, queue, flush };
}
