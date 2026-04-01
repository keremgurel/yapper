"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { playLeverCreak, playSlotSpin, playSlotLand } from "@/lib/audio";

interface SlotLeverProps {
  onPull: () => void;
}

export default function SlotLever({ onPull }: SlotLeverProps) {
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "pulling" | "spinning" | "landed"
  >("idle");
  const dragging = useRef(false);
  const startY = useRef(0);
  const lastCreak = useRef(0);
  const pullRef = useRef(0);
  const maxPull = 120;
  const threshold = 70;

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (phase !== "idle") return;
      e.preventDefault();
      dragging.current = true;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;
      startY.current = clientY - pullRef.current;
      setPhase("pulling");
    },
    [phase]
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
      const delta = Math.max(
        0,
        Math.min(maxPull, clientY - startY.current)
      );
      setPullY(delta);
      const now = Date.now();
      if (delta > 15 && now - lastCreak.current > 80) {
        playLeverCreak();
        lastCreak.current = now;
      }
    };

    const handleEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (pullRef.current >= threshold) {
        setPhase("spinning");
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
      <div className="relative flex flex-col items-center" style={{ width: "56px", height: "190px" }}>
        {/* Top mounting plate */}
        <div
          className="rounded-t-[5px] z-[2]"
          style={{
            width: "40px",
            height: "18px",
            background: "linear-gradient(to bottom, #4a5568, #2d3748)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
        {/* Shaft */}
        <div
          className="relative rounded-sm"
          style={{
            width: "8px",
            height: "130px",
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
              transition: dragging.current
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
            transition: dragging.current
              ? "none"
              : "top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div
            className="rounded-full flex items-center justify-center"
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
                phase === "idle" || phase === "pulling"
                  ? "grab"
                  : "default",
              transition: dragging.current ? "none" : "all 0.3s",
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
        className="mt-2.5 text-[10px] font-semibold uppercase tracking-[1.5px]"
        style={{
          color:
            phase === "spinning"
              ? "#f59e0b"
              : isPastThreshold
              ? "#f59e0b"
              : phase === "landed"
              ? "#22c55e"
              : "#64748b",
        }}
      >
        {phase === "spinning"
          ? "SPINNING..."
          : phase === "landed"
          ? "LANDED!"
          : isPastThreshold
          ? "RELEASE!"
          : "PULL"}
      </div>
      {phase === "idle" && pullY === 0 && (
        <div className="mt-0.5 text-sm text-slate-500 animate-bounce">
          ↓
        </div>
      )}
    </div>
  );
}
