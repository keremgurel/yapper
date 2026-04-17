"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampTimerSeconds } from "@/lib/practice-helpers";
import { trackTimerAdjusted } from "@/lib/analytics";

export function useTimerEditor(opts: {
  timerSeconds: number;
  isRunning: boolean;
  onTimerSecondsChange: (seconds: number) => void;
  onTimeLeftChange: (seconds: number) => void;
}) {
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");

  const lastTimerTapRef = useRef(0);
  const timeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!timeEditorOpen) return;
    requestAnimationFrame(() => {
      timeInputRef.current?.focus();
      timeInputRef.current?.select();
    });
  }, [timeEditorOpen]);

  const openTimeEditor = useCallback(() => {
    setTimeDraft(String(opts.timerSeconds));
    setTimeEditorOpen(true);
  }, [opts.timerSeconds]);

  const saveTimeDraft = useCallback(() => {
    const parsed = parseInt(timeDraft, 10);
    if (Number.isNaN(parsed)) {
      setTimeDraft(String(opts.timerSeconds));
      setTimeEditorOpen(false);
      return;
    }

    const nextSeconds = clampTimerSeconds(parsed);
    opts.onTimerSecondsChange(nextSeconds);
    if (!opts.isRunning) opts.onTimeLeftChange(nextSeconds);
    trackTimerAdjusted({ seconds: nextSeconds });
    setTimeEditorOpen(false);
  }, [opts, timeDraft]);

  const cancelTimeDraft = useCallback(() => {
    setTimeDraft(String(opts.timerSeconds));
    setTimeEditorOpen(false);
  }, [opts.timerSeconds]);

  const handleKnobChange = useCallback(
    (value: number) => {
      const nextSeconds = clampTimerSeconds(value);
      opts.onTimerSecondsChange(nextSeconds);
      if (!opts.isRunning) opts.onTimeLeftChange(nextSeconds);
    },
    [opts],
  );

  const handleTimerDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (opts.isRunning) return;
      event.preventDefault();
      openTimeEditor();
    },
    [opts.isRunning, openTimeEditor],
  );

  const handleTimerTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (opts.isRunning) return;
      const now = Date.now();
      if (now - lastTimerTapRef.current < 320) {
        event.preventDefault();
        openTimeEditor();
        lastTimerTapRef.current = 0;
      } else {
        lastTimerTapRef.current = now;
      }
    },
    [opts.isRunning, openTimeEditor],
  );

  const closeEditor = useCallback(() => {
    setTimeEditorOpen(false);
  }, []);

  return {
    timeEditorOpen,
    timeDraft,
    timeInputRef,
    setTimeDraft,
    openTimeEditor,
    saveTimeDraft,
    cancelTimeDraft,
    handleKnobChange,
    handleTimerDoubleClick,
    handleTimerTouchEnd,
    closeEditor,
  };
}
