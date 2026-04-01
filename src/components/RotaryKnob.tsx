"use client";

import { useRef, useCallback, useEffect } from "react";
import { playLuxuryDetent } from "@/lib/audio";

interface RotaryKnobProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export default function RotaryKnob({
  value,
  onChange,
  min = 30,
  max = 120,
  disabled = false,
}: RotaryKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startAngle = useRef(0);
  const startValue = useRef(value);
  const currentValue = useRef(value);

  const totalSteps = max - min;
  const totalRotation = 270;
  const degreesPerStep = totalRotation / totalSteps;
  const currentRotation = (value - min) * degreesPerStep - totalRotation / 2;

  const accentColor = "#c8a864";
  const accentDim = "rgba(200,168,100,0.2)";
  const accentBright = "rgba(200,168,100,0.5)";

  const getAngle = useCallback(
    (e: MouseEvent | TouchEvent, rect: DOMRect) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;
      return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    },
    []
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragging.current = true;
      startValue.current = currentValue.current;
      const rect = knobRef.current!.getBoundingClientRect();
      const nativeEvent = "touches" in e ? e.nativeEvent : e.nativeEvent;
      startAngle.current = getAngle(nativeEvent as MouseEvent, rect);
    },
    [disabled, getAngle]
  );

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || disabled) return;
      e.preventDefault();
      const rect = knobRef.current!.getBoundingClientRect();
      const angle = getAngle(e, rect);
      let delta = angle - startAngle.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const stepDelta = Math.round(delta / degreesPerStep);
      const newVal = Math.max(
        min,
        Math.min(max, startValue.current + stepDelta)
      );
      if (newVal !== currentValue.current) {
        playLuxuryDetent(newVal, min, max);
        currentValue.current = newVal;
        onChange(newVal);
      }
    };

    const handleEnd = () => {
      dragging.current = false;
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
  }, [disabled, min, max, degreesPerStep, getAngle, onChange]);

  const labelSteps = [30, 45, 60, 75, 90, 105, 120];
  const tickMarks = [];
  for (let s = min; s <= max; s += 5) {
    const rot = (s - min) * degreesPerStep - totalRotation / 2;
    const isLabel = labelSteps.includes(s);
    const isActive = s <= value;
    tickMarks.push(
      <div
        key={s}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none"
        style={{ transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm transition-all duration-100"
          style={{
            top: isLabel ? "2px" : "6px",
            width: isLabel ? "3px" : "2px",
            height: isLabel ? "14px" : "8px",
            backgroundColor: isActive ? accentColor : "var(--tick-inactive)",
            boxShadow: isActive ? `0 0 3px ${accentDim}` : "none",
          }}
        />
      </div>
    );
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className="relative transition-opacity duration-300"
        style={{
          width: "160px",
          height: "160px",
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {tickMarks}
        {/* Warm glow ring */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow duration-300"
          style={{
            width: "115px",
            height: "115px",
            boxShadow: disabled ? "none" : `0 0 15px ${accentDim}`,
          }}
        />
        {/* Knob body */}
        <div
          ref={knobRef}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full select-none flex items-center justify-center"
          style={{
            width: "100px",
            height: "100px",
            background:
              "conic-gradient(from 0deg, #b8b8b8, #e8e8e8 15%, #a0a0a0 30%, #d8d8d8 45%, #909090 60%, #c8c8c8 75%, #a8a8a8 90%, #b8b8b8)",
            boxShadow:
              "0 6px 20px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.1)",
            cursor: disabled ? "not-allowed" : "grab",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Inner recessed ring */}
          <div
            className="rounded-full flex items-center justify-center relative"
            style={{
              width: "78px",
              height: "78px",
              background: "linear-gradient(145deg, #d0d0d0, #b0b0b0)",
              boxShadow:
                "inset 0 2px 6px rgba(0,0,0,0.15), inset 0 -1px 0 rgba(255,255,255,0.5)",
            }}
          >
            {/* Gold indicator dot */}
            <div
              className="absolute rounded-full"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: accentColor,
                boxShadow: `0 0 4px ${accentBright}`,
                top: "8px",
                left: "50%",
                transform: `translateX(-50%) rotate(${currentRotation}deg)`,
                transformOrigin: `0px ${78 / 2 - 8}px`,
                transition: dragging.current
                  ? "none"
                  : "transform 0.1s ease-out",
              }}
            />
            {/* Chrome cap */}
            <div
              className="rounded-full"
              style={{
                width: "20px",
                height: "20px",
                background:
                  "radial-gradient(circle at 35% 35%, #f0f0f0, #a0a0a0, #808080)",
                boxShadow:
                  "0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
            />
          </div>
        </div>
      </div>
      <div className="font-mono text-[26px] font-bold tracking-wider text-foreground">
        {formatTime(value)}
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-[1.5px]">
        {disabled ? "LOCKED" : "DRAG TO SET"}
      </div>
    </div>
  );
}
