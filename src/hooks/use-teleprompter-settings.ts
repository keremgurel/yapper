"use client";

import { useCallback, useState } from "react";

/** How the teleprompter overlay looks and behaves, tuned live by the creator. */
export interface TeleprompterSettings {
  /** Multiplier on the base text size and, so the reading pace stays right, on
   * the scroll speed. */
  fontScale: number;
  /** Share of the frame height the prompt occupies, as a percentage. */
  heightPct: number;
  /** Opacity of the readability shade behind the text (0-1). */
  opacity: number;
  /** Seconds to hold before the prompt starts scrolling once recording begins,
   * so you can open on camera before reading. */
  leadInSec: number;
}

export const FONT_SCALES = [
  { value: 0.85, label: "S" },
  { value: 1, label: "M" },
  { value: 1.2, label: "L" },
  { value: 1.45, label: "XL" },
] as const;

export const HEIGHTS = [
  { value: 32, label: "Short" },
  { value: 44, label: "Medium" },
  { value: 60, label: "Tall" },
] as const;

export const OPACITIES = [
  { value: 0.5, label: "Low" },
  { value: 0.75, label: "Medium" },
  { value: 0.95, label: "High" },
] as const;

export const LEAD_INS = [0, 2, 3, 5] as const;

const DEFAULTS: TeleprompterSettings = {
  fontScale: 1,
  heightPct: 44,
  opacity: 0.75,
  leadInSec: 3,
};

/**
 * The teleprompter's live look-and-feel settings, held for the session. One
 * `update` mutator patches any subset, kept stable so it never churns the
 * memoized callbacks the React Compiler lint watches.
 */
export function useTeleprompterSettings() {
  const [settings, setSettings] = useState<TeleprompterSettings>(DEFAULTS);

  const update = useCallback((patch: Partial<TeleprompterSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update };
}
