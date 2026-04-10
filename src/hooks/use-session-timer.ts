"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playTimerEnd } from "@/lib/audio";

export function useSessionTimer(opts: { onTimerExpired?: () => void }) {
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimerExpiredRef = useRef(opts.onTimerExpired);

  useEffect(() => {
    onTimerExpiredRef.current = opts.onTimerExpired;
  }, [opts.onTimerExpired]);

  const inSession = isRunning || isPaused;

  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((current) => {
          if (current <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            setIsRunning(false);
            setTimerDone(true);
            playTimerEnd();
            onTimerExpiredRef.current?.();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, isRunning, timeLeft]);

  const start = useCallback(() => {
    setTimeLeft(timerSeconds);
    setIsRunning(true);
    setIsPaused(false);
    setTimerDone(false);
  }, [timerSeconds]);

  const pause = useCallback(() => {
    setIsPaused((current) => !current);
  }, []);

  const finish = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimerDone(true);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
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
    inSession,
    setTimerSeconds,
    setTimeLeft,
    start,
    pause,
    finish,
    reset,
  };
}
