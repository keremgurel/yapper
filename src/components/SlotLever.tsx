"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  playLeverCreak,
  playLeverRelease,
  preloadLeverSound,
  playSlotSpin,
  playSlotLand,
} from "@/lib/audio";

interface SlotLeverProps {
  onPull: () => void;
}

export default function SlotLever({ onPull }: SlotLeverProps) {
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "pulling" | "spinning" | "landed"
  >("idle");
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const thresholdSoundPlayed = useRef(false);
  const pullRef = useRef(0);
  const maxPull = 120;
  const threshold = 70;

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (phase !== "idle") return;
      e.preventDefault();
      dragging.current = true;
      setIsDragging(true);
      preloadLeverSound();
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startY.current = clientY - pullRef.current;
      thresholdSoundPlayed.current = false;
      setPhase("pulling");
    },
    [phase],
  );

  useEffect(() => {
    pullRef.current = pullY;
  }, [pullY]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || phase !== "pulling") return;
      e.preventDefault();
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const delta = Math.max(0, Math.min(maxPull, clientY - startY.current));
      setPullY(delta);

      if (delta >= threshold && !thresholdSoundPlayed.current) {
        playLeverCreak();
        thresholdSoundPlayed.current = true;
      } else if (delta < threshold - 10) {
        thresholdSoundPlayed.current = false;
      }
    };

    const handleEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);

      if (pullRef.current >= threshold) {
        setPhase("spinning");
        playLeverRelease();
        playSlotSpin();
        setPullY(0);
        setTimeout(() => {
          playSlotLand();
          setPhase("landed");
          onPull();
          setTimeout(() => setPhase("idle"), 400);
        }, 600);
      } else {
        setPullY(0);
        setPhase("idle");
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [phase, onPull]);

  const progress = pullY / maxPull;
  const isPastThreshold = pullY >= threshold;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="mb-2 text-[9px] font-semibold tracking-[2px] text-slate-950 uppercase drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
        Generate
      </div>
      <div
        className="relative flex flex-col items-center"
        style={{ width: "56px", height: "160px" }}
      >
        {/* Top mounting plate */}
        <div
          className="z-[2] rounded-t-[5px]"
          style={{
            width: "40px",
            height: "18px",
            background: "linear-gradient(to bottom, #4a5568, #2d3748)",
            boxShadow:
              "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
        {/* Shaft */}
        <div
          className="relative rounded-sm"
          style={{
            width: "8px",
            height: "105px",
            background: "linear-gradient(to right, #1a202c, #2d3748, #1a202c)",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          {/* Fill bar */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-[3px]"
            style={{
              width: "5px",
              height: `${20 + progress * 75}%`,
              background: isPastThreshold
                ? "linear-gradient(to bottom, #4a5568, #f59e0b)"
                : "linear-gradient(to bottom, #4a5568, #718096)",
              transition: isDragging
                ? "none"
                : "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              boxShadow: isPastThreshold
                ? "0 0 8px rgba(245,158,11,0.3)"
                : "none",
            }}
          />
          {/* Threshold line */}
          <div
            className="absolute rounded-sm"
            style={{
              top: `${(threshold / maxPull) * 100}%`,
              left: "-5px",
              right: "-5px",
              height: "2px",
              backgroundColor: isPastThreshold ? "#f59e0b" : "#4a5568",
              opacity: 0.5,
            }}
          />
        </div>
        {/* Ball grip */}
        <div
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          className="absolute z-[3]"
          style={{
            top: `${18 + progress * 115}px`,
            left: "50%",
            transform: "translateX(-50%)",
            transition: isDragging
              ? "none"
              : "top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: "44px",
              height: "44px",
              background:
                isPastThreshold || phase === "spinning"
                  ? "radial-gradient(circle at 35% 35%, #fbbf24, #d97706, #92400e)"
                  : "radial-gradient(circle at 35% 35%, #e2e8f0, #94a3b8, #64748b)",
              boxShadow: isPastThreshold
                ? "0 4px 16px rgba(217,119,6,0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
                : "0 4px 12px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.4)",
              cursor:
                phase === "idle" || phase === "pulling" ? "grab" : "default",
              transition: isDragging ? "none" : "all 0.3s",
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: "16px",
                height: "10px",
                background: "rgba(255,255,255,0.2)",
                transform: "rotate(-30deg) translateY(-5px)",
              }}
            />
          </div>
        </div>
        {/* Bottom mounting plate */}
        <div
          className="rounded-b-[5px]"
          style={{
            width: "40px",
            height: "12px",
            background: "linear-gradient(to bottom, #2d3748, #1a202c)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        />
      </div>
      <div
        className={`mt-2.5 flex h-[14px] w-[7rem] shrink-0 items-center justify-center text-center text-[10px] font-semibold tracking-[1.5px] uppercase drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
          phase === "landed"
            ? "text-emerald-800 dark:text-emerald-300"
            : phase === "spinning"
              ? "text-slate-950 dark:text-white/90"
              : isPastThreshold
                ? "text-amber-800 dark:text-amber-300"
                : "text-slate-950 dark:text-white/90"
        }`}
        aria-live="polite"
      >
        {phase === "spinning" ? (
          <span className="sr-only">Generating topic</span>
        ) : phase === "landed" ? (
          "LANDED!"
        ) : isPastThreshold ? (
          "RELEASE!"
        ) : (
          "PULL"
        )}
      </div>
      <div
        className={`mt-0.5 animate-bounce text-sm text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] transition-opacity dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
          phase === "idle" && pullY === 0 ? "opacity-100" : "opacity-0"
        }`}
      >
        ↓
      </div>
    </div>
  );
}
