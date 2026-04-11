"use client";

import { useState, type ReactNode } from "react";

/* ── shared styling logic ── */

const OUTER_GRADIENT = `linear-gradient(180deg,
  rgb(255,255,255) 0%,
  rgb(201,201,201) 9%,
  rgb(161,161,161) 32%,
  rgb(117,117,117) 73%,
  rgb(255,255,255) 100%)`;

const INNER_GRADIENT = `linear-gradient(150deg,
  rgb(218,218,218) 0%,
  rgb(210,210,210) 40%,
  rgb(200,200,200) 100%)`;

const SPRING =
  "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease";

function outerShadow(state: "default" | "hover" | "pressed") {
  if (state === "pressed")
    return `0px 1px 2px rgba(0,0,0,0.06),
            0px 2px 4px rgba(0,0,0,0.04),
            0px 3px 6px rgba(0,0,0,0.03)`;
  if (state === "hover")
    return `0px 1px 2px rgba(0,0,0,0.08),
            0px 2px 4px rgba(0,0,0,0.06),
            0px 4px 8px rgba(0,0,0,0.05),
            0px 6px 14px rgba(0,0,0,0.04)`;
  return `0px 1px 2px rgba(0,0,0,0.08),
          0px 2px 4px rgba(0,0,0,0.06),
          0px 4px 8px rgba(0,0,0,0.04),
          0px 8px 16px rgba(0,0,0,0.03)`;
}

function innerShadow(pressed: boolean) {
  return pressed
    ? `inset 2px 3px 5px rgba(0,0,0,0.12),
       inset 0px 0px 1px 1px rgba(0,0,0,0.06)`
    : `inset 1px 2px 4px rgba(0,0,0,0.04),
       inset 0px -1px 2px rgba(255,255,255,0.6)`;
}

function useGlassState() {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const state = pressed ? "pressed" : hovered ? "hover" : "default";
  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => {
      setHovered(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
  };
  return { pressed, state, handlers } as const;
}

/* ── GlassyIconButton (square, icon only) ── */

interface GlassyIconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: number;
  className?: string;
}

export function GlassyIconButton({
  children,
  onClick,
  size = 64,
  className = "",
}: GlassyIconButtonProps) {
  const { pressed, state, handlers } = useGlassState();
  const radius = size * 0.27;

  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        padding: size * 0.02,
        borderRadius: radius,
        border: "none",
        cursor: "pointer",
        willChange: "transform",
        background: OUTER_GRADIENT,
        boxShadow: outerShadow(state),
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: SPRING,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          borderRadius: radius - 2,
          background: INNER_GRADIENT,
          boxShadow: innerShadow(pressed),
          transition: "box-shadow 0.3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
            transition: "opacity 0.2s ease",
            color: "rgba(0,0,0,0.7)",
          }}
        >
          {children}
        </div>
      </div>
    </button>
  );
}

/* ── GlassyButton (pill, optional leading icon + label) ── */

interface GlassyButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  height?: number;
  className?: string;
}

export function GlassyButton({
  children,
  icon,
  onClick,
  height = 52,
  className = "",
}: GlassyButtonProps) {
  const { pressed, state, handlers } = useGlassState();
  const radius = 8;

  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height,
        padding: 2,
        borderRadius: radius,
        border: "none",
        cursor: "pointer",
        willChange: "transform",
        background: OUTER_GRADIENT,
        boxShadow: outerShadow(state),
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: SPRING,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: "100%",
          paddingLeft: icon ? height * 0.28 : height * 0.38,
          paddingRight: height * 0.38,
          borderRadius: radius - 1,
          background: INNER_GRADIENT,
          boxShadow: innerShadow(pressed),
          transition: "box-shadow 0.3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: pressed ? 0.8 : 1,
            transition: "opacity 0.2s ease",
            color: "rgba(0,0,0,0.7)",
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {icon}
          {children}
        </div>
      </div>
    </button>
  );
}

/* keep default export for backward compat */
export default GlassyIconButton;
