"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveOpts {
  keepalive?: boolean;
}

type SaveFn<T> = (dirty: Partial<T>, opts?: SaveOpts) => Promise<void>;

/**
 * A debounced, serialized save queue for autosaving a form to the server.
 * One concern: collect dirty fields, save them in order, never overlap.
 *
 * - queue(fields) merges into the pending dirty set and (re)arms the debounce.
 * - Saves are chained on one promise, so a slow response can never land after
 *   (and clobber) a newer one.
 * - Each batch is bound to the save function that was current when its first
 *   field was queued. If the save identity changes mid-batch (e.g. the caller
 *   re-targets to a different record id), the old batch flushes with ITS save
 *   first, so pending fields can never be written to the wrong record.
 * - Failed saves re-merge their fields into pending (newer edits win), so the
 *   next edit retries them.
 * - On unmount and on pagehide, pending fields flush immediately; pagehide uses
 *   keepalive so the request survives a hard navigation. (The pagehide flush
 *   rides the promise chain: with no in-flight save it issues in a microtask,
 *   which survives unload; behind a slow in-flight save it may not. Accepted.)
 */
export function useAutosave<T extends object>(
  save: SaveFn<T>,
  debounceMs = 800,
) {
  const [state, setState] = useState<SaveState>("idle");
  const pendingRef = useRef<Partial<T>>({});
  // The save function the CURRENT pending batch belongs to (null = no batch).
  const batchSaveRef = useRef<SaveFn<T> | null>(null);
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
    const saveFn = batchSaveRef.current;
    if (Object.keys(dirty).length === 0 || !saveFn) return chainRef.current;
    pendingRef.current = {};
    batchSaveRef.current = null;
    set("saving");
    chainRef.current = chainRef.current
      .then(() => saveFn(dirty, opts))
      .then(
        () => {
          // Only report saved if nothing new queued up meanwhile.
          if (Object.keys(pendingRef.current).length === 0) set("saved");
        },
        () => {
          // Newer pending edits win over the failed payload's values; the
          // retry batch keeps the failed batch's save target.
          pendingRef.current = { ...dirty, ...pendingRef.current };
          batchSaveRef.current ??= saveFn;
          set("error");
        },
      );
    return chainRef.current;
  }, []);

  const queue = useCallback(
    (fields: Partial<T>) => {
      // Re-targeted (save identity changed) with a batch still pending: flush
      // the old batch to its own target before starting the new one.
      if (batchSaveRef.current && batchSaveRef.current !== saveRef.current) {
        void flush();
      }
      batchSaveRef.current ??= saveRef.current;
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
