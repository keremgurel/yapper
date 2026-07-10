"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export interface Anchor {
  x: number;
  y: number;
}

/** Never let the thing be dragged flush against an edge. */
const EDGE = 12;

/** A press that travels less than this is a click, not a drag. */
const JITTER = 4;

/**
 * Where each draggable thing is, outside React. Its first position needs the
 * window's size, which no render on the server can know, so the position is
 * read from a store rather than initialised into state.
 */
const positions = new Map<string, Anchor>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function clampToViewport(a: Anchor, size: number): Anchor {
  return {
    x: Math.min(window.innerWidth - size - EDGE, Math.max(EDGE, a.x)),
    y: Math.min(window.innerHeight - size - EDGE, Math.max(EDGE, a.y)),
  };
}

function load(key: string): Anchor | null {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<Anchor>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number")
      return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function place(key: string, next: Anchor, size: number) {
  const clamped = clampToViewport(next, size);
  const now = positions.get(key);
  if (now && now.x === clamped.x && now.y === clamped.y) return;
  positions.set(key, clamped);
  emit(key);
}

/**
 * A thing you can pick up and put anywhere on screen, remembered across
 * sessions and pulled back inside when the window shrinks under it.
 *
 * A press that never travels is a click, not a drag, so the thing being dragged
 * is still a button. `wasDragged` says which one it was, and the caller asks in
 * its click handler.
 */
export function useDraggableAnchor(
  storageKey: string,
  size: number,
  initial: (viewport: { w: number; h: number }) => Anchor,
) {
  const [dragging, setDragging] = useState(false);
  const [grab, setGrab] = useState<{
    dx: number;
    dy: number;
    x: number;
    y: number;
  } | null>(null);
  // A ref, not state: the click that follows pointerup has to read what the
  // pointer actually did, and a re-render per pointermove buys nothing.
  const movedRef = useRef(false);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!positions.has(storageKey)) {
        positions.set(
          storageKey,
          clampToViewport(
            load(storageKey) ??
              initial({ w: window.innerWidth, h: window.innerHeight }),
            size,
          ),
        );
      }
      let set = listeners.get(storageKey);
      if (!set) listeners.set(storageKey, (set = new Set()));
      set.add(onChange);
      const onResize = () => {
        const now = positions.get(storageKey);
        if (now) place(storageKey, now, size);
      };
      window.addEventListener("resize", onResize);
      return () => {
        set.delete(onChange);
        window.removeEventListener("resize", onResize);
      };
    },
    [storageKey, size, initial],
  );

  const anchor = useSyncExternalStore(
    subscribe,
    () => positions.get(storageKey) ?? null,
    () => null,
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !anchor) return;
      setGrab({
        dx: e.clientX - anchor.x,
        dy: e.clientY - anchor.y,
        x: e.clientX,
        y: e.clientY,
      });
      movedRef.current = false;
      setDragging(true);
    },
    [anchor],
  );

  useEffect(() => {
    if (!dragging || !grab) return;
    const onMove = (e: PointerEvent) => {
      if (!movedRef.current) {
        if (Math.hypot(e.clientX - grab.x, e.clientY - grab.y) < JITTER) return;
        movedRef.current = true;
      }
      place(
        storageKey,
        { x: e.clientX - grab.dx, y: e.clientY - grab.dy },
        size,
      );
    };
    const onUp = () => {
      setDragging(false);
      setGrab(null);
      if (!movedRef.current) return;
      const now = positions.get(storageKey);
      if (now) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(now));
        } catch {
          // Storage is a nicety here, not a requirement.
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, grab, storageKey, size]);

  const wasDragged = useCallback(() => movedRef.current, []);

  return { anchor, dragging, onPointerDown, wasDragged };
}
