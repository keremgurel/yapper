"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playTimerEnd } from "@/lib/audio";

export function useSessionTimer(opts: {
  onTimerExpired?: () => void;
  initialSeconds?: number;
}) {
  const [timerSeconds, setTimerSeconds] = useState(opts.initialSeconds ?? 60);
  const [timeLeft, setTimeLeft] = useState(opts.initialSeconds ?? 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const deadline = useRef<number | null>(null);
  const remaining = useRef(0);
  const onTimerExpiredRef = useRef(opts.onTimerExpired);
  useEffect(() => {
    onTimerExpiredRef.current = opts.onTimerExpired;
  }, [opts.onTimerExpired]);

  useEffect(() => {
    if (!isRunning || isPaused) return;
    const tick = () => {
      if (deadline.current === null) return;
      const milliseconds = Math.max(0, deadline.current - Date.now());
      setTimeLeft(Math.ceil(milliseconds / 1000));
      if (!milliseconds) {
        deadline.current = null;
        setIsRunning(false);
        setIsPaused(false);
        setTimerDone(true);
        playTimerEnd();
        onTimerExpiredRef.current?.();
      }
    };
    const interval = setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isRunning, isPaused]);

  const start = useCallback(() => {
    deadline.current = Date.now() + timerSeconds * 1000;
    setTimeLeft(timerSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerDone(false);
  }, [timerSeconds]);
  const pause = useCallback(() => {
    if (!isRunning) return;
    if (isPaused) deadline.current = Date.now() + remaining.current;
    else {
      remaining.current = Math.max(
        0,
        (deadline.current ?? Date.now()) - Date.now(),
      );
      deadline.current = null;
    }
    setIsPaused(!isPaused);
  }, [isPaused, isRunning]);
  const finish = useCallback(() => {
    deadline.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(true);
  }, []);
  const reset = useCallback(() => {
    deadline.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(false);
    setTimeLeft(timerSeconds);
  }, [timerSeconds]);

  return {
    timerSeconds,
    timeLeft,
    isRunning,
    isPaused,
    timerDone,
    inSession: isRunning || isPaused,
    setTimerSeconds,
    setTimeLeft,
    start,
    pause,
    finish,
    reset,
  };
}
