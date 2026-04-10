"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { playLuxuryDetent } from "@/lib/audio";

interface RotaryKnobProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const SIZE = 140;
const KNOB_SIZE = 88;
const INNER_SIZE = 68;

export default function RotaryKnob({
  value,
  onChange,
  min = 30,
  max = 90,
  disabled = false,
}: RotaryKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [isDraggingKnob, setIsDraggingKnob] = useState(false);
  const lastAngle = useRef(0);
  const accumulatedRotation = useRef(0);
  const currentValue = useRef(value);

  const totalSteps = max - min;
  const totalRotation = 270;
  const degreesPerStep = totalRotation / totalSteps;
  const currentRotation = (value - min) * degreesPerStep - totalRotation / 2;

  const accentColor = "#c8a864";

  const getAngle = useCallback((e: MouseEvent | TouchEvent, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !knobRef.current) return;
      e.preventDefault();
      dragging.current = true;
      setIsDraggingKnob(true);
      const rect = knobRef.current.getBoundingClientRect();
      const nativeEvent = e.nativeEvent;
      lastAngle.current = getAngle(nativeEvent as MouseEvent, rect);
      accumulatedRotation.current =
        (currentValue.current - min) * degreesPerStep;
    },
    [degreesPerStep, disabled, getAngle, min],
  );

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || disabled || !knobRef.current) return;
      e.preventDefault();
      const rect = knobRef.current.getBoundingClientRect();
      const angle = getAngle(e, rect);
      let delta = angle - lastAngle.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngle.current = angle;

      accumulatedRotation.current = Math.max(
        0,
        Math.min(totalRotation, accumulatedRotation.current + delta),
      );

      const newVal =
        min + Math.round(accumulatedRotation.current / degreesPerStep);

      if (newVal !== currentValue.current) {
        playLuxuryDetent(newVal, min, max);
        currentValue.current = newVal;
        onChange(newVal);
      }
    };
    const handleEnd = () => {
      dragging.current = false;
      setIsDraggingKnob(false);
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
  }, [degreesPerStep, disabled, getAngle, max, min, onChange, totalRotation]);

  // Build tick marks using absolute positioning with trig
  const labelSteps = [30, 45, 60, 75, 90];
  const tickElements = [];
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = SIZE / 2 - 2; // where ticks start (outer edge)

  for (let s = min; s <= max; s += 5) {
    const isLabel = labelSteps.includes(s);
    const isActive = s <= value;
    const tickLen = isLabel ? 14 : 8;
    const tickW = isLabel ? 3 : 2;

    // Angle: map value to rotation. 0 step = -135deg from top, last step = +135deg
    const angleDeg =
      ((s - min) / totalSteps) * totalRotation - totalRotation / 2;
    // Convert to radians, offset by -90 so 0deg = top
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;

    const x1 = cx + outerR * Math.cos(angleRad);
    const y1 = cy + outerR * Math.sin(angleRad);
    const x2 = cx + (outerR - tickLen) * Math.cos(angleRad);
    const y2 = cy + (outerR - tickLen) * Math.sin(angleRad);

    tickElements.push(
      <line
        key={s}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isActive ? accentColor : "var(--tick-inactive)"}
        strokeWidth={tickW}
        strokeLinecap="round"
        style={{
          filter: isActive
            ? `drop-shadow(0 0 2px rgba(200,168,100,0.3))`
            : "none",
          transition: "stroke 0.1s, filter 0.1s",
        }}
      />,
    );
  }

  const formatSeconds = (s: number) => `${Math.round(s)}s`;

  // Indicator dot position on the inner ring
  const indicatorAngleDeg = currentRotation - 90;
  const indicatorAngleRad = (indicatorAngleDeg * Math.PI) / 180;
  const indicatorR = INNER_SIZE / 2 - 10;
  const dotX = cx + indicatorR * Math.cos(indicatorAngleRad);
  const dotY = cy + indicatorR * Math.sin(indicatorAngleRad);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div className="mb-0.5 text-[9px] font-semibold tracking-[2px] text-white/80 uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
        Timer
      </div>
      <div
        style={{
          position: "relative",
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          opacity: disabled ? 0.35 : 1,
          transition: "opacity 0.3s",
        }}
      >
        {/* SVG tick marks */}
        <svg
          width={SIZE}
          height={SIZE}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          {tickElements}
        </svg>

        {/* Glow ring */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: `${KNOB_SIZE + 15}px`,
            height: `${KNOB_SIZE + 15}px`,
            borderRadius: "50%",
            boxShadow: disabled ? "none" : `0 0 15px rgba(200,168,100,0.15)`,
            transition: "box-shadow 0.3s",
          }}
        />

        {/* Knob body */}
        <div
          ref={knobRef}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: `${KNOB_SIZE}px`,
            height: `${KNOB_SIZE}px`,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, #b8b8b8, #e8e8e8 15%, #a0a0a0 30%, #d8d8d8 45%, #909090 60%, #c8c8c8 75%, #a8a8a8 90%, #b8b8b8)",
            boxShadow:
              "0 6px 20px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.1)",
            cursor: disabled ? "not-allowed" : "grab",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Inner recessed ring */}
          <div
            style={{
              width: `${INNER_SIZE}px`,
              height: `${INNER_SIZE}px`,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #d0d0d0, #b0b0b0)",
              boxShadow:
                "inset 0 2px 6px rgba(0,0,0,0.15), inset 0 -1px 0 rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Chrome cap */}
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 35% 35%, #f0f0f0, #a0a0a0, #808080)",
                boxShadow:
                  "0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
            />
          </div>
        </div>

        {/* SVG indicator dot (rendered on top) */}
        <svg
          width={SIZE}
          height={SIZE}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <circle
            cx={dotX}
            cy={dotY}
            r={3}
            fill={accentColor}
            style={{
              filter: `drop-shadow(0 0 3px rgba(200,168,100,0.5))`,
              transition: isDraggingKnob
                ? "none"
                : "cx 0.1s ease-out, cy 0.1s ease-out",
            }}
          />
        </svg>
      </div>

      <div className="font-mono text-[22px] font-bold tracking-[2px] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
        {formatSeconds(value)}
      </div>
      <div className="text-[10px] tracking-[1.5px] text-white/78 uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
        {disabled ? "LOCKED" : "DRAG TO SET"}
      </div>
    </div>
  );
}
