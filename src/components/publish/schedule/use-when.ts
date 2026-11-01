"use client";

import { useState } from "react";
import { localScheduleInput } from "@/lib/publish/schedule-client";
import { quickTimes } from "./quick-times";
import type { WhenMode } from "./when-picker";

/** A `?scheduleAt=` link (from a Calendar day) or a time Chirpy suggested
 * opens straight on Schedule with that time; otherwise Post now, with
 * tomorrow morning ready. */
function initial(suggested?: string): { mode: WhenMode; value: string } {
  const requested =
    suggested ??
    (typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("scheduleAt"));
  const date = requested ? new Date(requested) : null;
  if (date && Number.isFinite(date.getTime()) && date.getTime() > Date.now())
    return { mode: "later", value: localScheduleInput(date) };
  return {
    mode: "now",
    value: localScheduleInput(quickTimes(new Date())[0].at),
  };
}

/** Now or later, and the local wall-clock time chosen for later. */
export function useWhen(suggested?: string) {
  const [state, setState] = useState(() => initial(suggested));
  return {
    mode: state.mode,
    value: state.value,
    at: state.value ? new Date(state.value) : null,
    setMode: (mode: WhenMode) => setState((current) => ({ ...current, mode })),
    setValue: (value: string) => setState((current) => ({ ...current, value })),
  };
}
