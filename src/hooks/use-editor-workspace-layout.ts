"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "yapper.editor.workspace.v1";
const DEFAULT_WORKBENCH_WIDTH = 410;
const DEFAULT_TIMELINE_HEIGHT = 320;
const MIN_WORKBENCH_WIDTH = 300;
const MIN_PREVIEW_WIDTH = 420;
const MIN_TIMELINE_HEIGHT = 220;
const MIN_PREVIEW_HEIGHT = 260;

type StoredLayout = {
  workbenchWidth: number;
  timelineHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function readStoredLayout(): StoredLayout | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "");
    if (
      typeof parsed?.workbenchWidth === "number" &&
      typeof parsed?.timelineHeight === "number"
    ) {
      return parsed;
    }
  } catch {
    // A blocked or corrupt preference should never block the editor.
  }
  return null;
}

function storeLayout(layout: StoredLayout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // The workspace remains resizable even when storage is unavailable.
  }
}

/**
 * Persistent dimensions for the editor's three primary surfaces. Resizing the
 * Workbench gives space to or takes space from Preview; resizing Timeline does
 * the same vertically. The media elements never remount during either drag.
 */
export function useEditorWorkspaceLayout() {
  const [workbenchWidth, setWorkbenchWidth] = useState(DEFAULT_WORKBENCH_WIDTH);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);
  const dimensions = useRef({
    workbenchWidth: DEFAULT_WORKBENCH_WIDTH,
    timelineHeight: DEFAULT_TIMELINE_HEIGHT,
  });
  const drag = useRef<
    | { axis: "x"; origin: number; size: number }
    | { axis: "y"; origin: number; size: number }
    | null
  >(null);

  const commit = useCallback((next: StoredLayout) => {
    dimensions.current = next;
    setWorkbenchWidth(next.workbenchWidth);
    setTimelineHeight(next.timelineHeight);
  }, []);

  useEffect(() => {
    const stored = readStoredLayout();
    if (!stored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser preference hydration
    commit(stored);
  }, [commit]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = drag.current;
      if (!active) return;

      if (active.axis === "x") {
        const nextWidth = clamp(
          active.size + event.clientX - active.origin,
          MIN_WORKBENCH_WIDTH,
          window.innerWidth - MIN_PREVIEW_WIDTH,
        );
        const next = {
          ...dimensions.current,
          workbenchWidth: nextWidth,
        };
        dimensions.current = next;
        setWorkbenchWidth(nextWidth);
        return;
      }

      const nextHeight = clamp(
        active.size + active.origin - event.clientY,
        MIN_TIMELINE_HEIGHT,
        window.innerHeight - MIN_PREVIEW_HEIGHT,
      );
      const next = { ...dimensions.current, timelineHeight: nextHeight };
      dimensions.current = next;
      setTimelineHeight(nextHeight);
    };

    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      storeLayout(dimensions.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const startWorkbenchResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    drag.current = {
      axis: "x",
      origin: event.clientX,
      size: dimensions.current.workbenchWidth,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  const startTimelineResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    drag.current = {
      axis: "y",
      origin: event.clientY,
      size: dimensions.current.timelineHeight,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
  }, []);

  const adjustWorkbench = useCallback(
    (delta: number) => {
      const next = {
        ...dimensions.current,
        workbenchWidth: clamp(
          dimensions.current.workbenchWidth + delta,
          MIN_WORKBENCH_WIDTH,
          window.innerWidth - MIN_PREVIEW_WIDTH,
        ),
      };
      commit(next);
      storeLayout(next);
    },
    [commit],
  );

  const adjustTimeline = useCallback(
    (delta: number) => {
      const next = {
        ...dimensions.current,
        timelineHeight: clamp(
          dimensions.current.timelineHeight + delta,
          MIN_TIMELINE_HEIGHT,
          window.innerHeight - MIN_PREVIEW_HEIGHT,
        ),
      };
      commit(next);
      storeLayout(next);
    },
    [commit],
  );

  const resetWorkbench = useCallback(() => {
    const next = {
      ...dimensions.current,
      workbenchWidth: DEFAULT_WORKBENCH_WIDTH,
    };
    commit(next);
    storeLayout(next);
  }, [commit]);

  const resetTimeline = useCallback(() => {
    const next = {
      ...dimensions.current,
      timelineHeight: DEFAULT_TIMELINE_HEIGHT,
    };
    commit(next);
    storeLayout(next);
  }, [commit]);

  return {
    workbenchWidth,
    timelineHeight,
    startWorkbenchResize,
    startTimelineResize,
    adjustWorkbench,
    adjustTimeline,
    resetWorkbench,
    resetTimeline,
  };
}
