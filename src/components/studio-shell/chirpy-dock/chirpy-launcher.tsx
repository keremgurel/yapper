"use client";

import { forwardRef, useState } from "react";
import { GlassButton } from "@glass-sdk/liquid-glass";
import { StudioGlassScene } from "@/components/studio-ui/liquid-glass";
import { Chirpy, type ChirpyExpression } from "@/components/brand/chirpy";
import styles from "@/components/studio-shell/chirpy-dock/chirpy-dock.module.css";

export const LAUNCHER_SIZE = 72;

type DragHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
};

/**
 * The bird itself: a glass button that opens Chirpy, can be dragged anywhere,
 * and dances when it says hello. Its face follows the conversation (the
 * parent's expression) unless the creator is touching it.
 */
const ChirpyLauncher = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    expression: ChirpyExpression;
    talking: boolean;
    dancing: boolean;
    dragging: boolean;
    drag: DragHandlers;
    onActivate: () => void;
  }
>(function ChirpyLauncher(
  { open, expression, talking, dancing, dragging, drag, onActivate },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const face: ChirpyExpression = dragging
    ? "happy"
    : pressed
      ? "wink"
      : dancing
        ? "happy"
        : hovered && expression === "idle"
          ? "curious"
          : expression;

  return (
    <StudioGlassScene className="rounded-full">
      <GlassButton
        type="button"
        size="icon-lg"
        ref={ref}
        aria-label={open ? "Close Chirpy" : "Ask Chirpy"}
        aria-expanded={open}
        aria-controls={open ? "chirpy-panel" : undefined}
        title={open ? "Close Chirpy · ⌘K" : "Ask Chirpy · ⌘K · drag to move"}
        onClick={onActivate}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={(event: React.PointerEvent<HTMLElement>) => {
          setPressed(true);
          drag.onPointerDown(event);
        }}
        onPointerMove={drag.onPointerMove}
        onPointerUp={(event: React.PointerEvent<HTMLElement>) => {
          setPressed(false);
          drag.onPointerUp(event);
        }}
        onPointerCancel={(event: React.PointerEvent<HTMLElement>) => {
          setPressed(false);
          drag.onPointerCancel(event);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => {
          setHovered(false);
          setPressed(false);
        }}
        className={`pointer-events-auto size-[72px]! touch-none rounded-full! select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        } motion-safe:transition-transform motion-safe:duration-150 ${
          dragging ? "scale-105" : "motion-safe:active:scale-95"
        }`}
      >
        <span
          className={`grid place-items-center ${dancing ? styles.dance : ""}`}
        >
          <Chirpy
            expression={face}
            talking={talking || dancing}
            size={54}
            className="pointer-events-none size-[54px]!"
          />
        </span>
      </GlassButton>
    </StudioGlassScene>
  );
});

export default ChirpyLauncher;
