"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LAYOUT, isLayoutId, type LayoutId } from "@/lib/studio/layout";

const KEY = "yapper.studio.layout";
const EVENT = "yapper:layout";

/** The truth when the browser refuses storage, so the picker still works. */
let memory: LayoutId | null = null;

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  // Another tab of the same editor should not be left in a stale arrangement.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): LayoutId {
  if (memory) return memory;
  try {
    const saved = window.localStorage.getItem(KEY);
    return isLayoutId(saved) ? saved : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * Which arrangement the editor is in. Remembered across sessions: it is a
 * preference about the room, not about the project.
 *
 * Stored outside React so the server renders the default and the client
 * subscribes to what was actually saved, without a render that lies.
 */
export function useStudioLayout(): {
  layout: LayoutId;
  setLayout: (id: LayoutId) => void;
} {
  const layout = useSyncExternalStore(subscribe, read, () => DEFAULT_LAYOUT);

  const setLayout = useCallback((id: LayoutId) => {
    memory = id;
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // A browser that refuses storage still gets to change the layout.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { layout, setLayout };
}
