"use client";

import { useCallback, useState } from "react";
import AiCommandBar from "@/components/studio/ai-command-bar";
import { useStudio } from "@/components/studio/studio-context";
import {
  BirdMascot,
  type ChirpyExpression,
} from "@/components/brand/bird-mascot";
import { useDraggableAnchor, type Anchor } from "@/hooks/use-draggable-anchor";
import { useOverlayPlacement } from "@/hooks/use-overlay-placement";

const ORB = 56;
const STORAGE_KEY = "yapper.studio.assistant";

/** Bottom-right to begin with, where a helper is expected to live. */
const startingCorner = (viewport: { w: number; h: number }): Anchor => ({
  x: viewport.w - ORB - 20,
  y: viewport.h - ORB - 20,
});

/**
 * Yapper, in the corner. Press the bird and it grows into the command bar; drag
 * it and it goes wherever you put it, and stays there.
 *
 * The bird reacts: it looks up when you hover, yaps while it is thinking, and is
 * pleased with itself when a cutaway lands. The bar opens away from whichever
 * edges the bird is nearest, so it is never half off the screen.
 */
export default function AiAssistant() {
  const { words, mediaAssets } = useStudio();
  const placement = useOverlayPlacement();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const { anchor, dragging, onPointerDown, wasDragged } = useDraggableAnchor(
    STORAGE_KEY,
    ORB,
    startingCorner,
  );

  // The bird is pleased for exactly as long as the result is on screen, which
  // is a thing the state already says. No timer, and nothing to keep in sync.
  const pleased =
    placement.status === "done" && (placement.result?.placed ?? 0) > 0;
  const thinking = placement.status === "thinking";
  const expression: ChirpyExpression = thinking
    ? "yap"
    : pleased
      ? "happy"
      : placement.status === "error"
        ? "oops"
        : hover || dragging
          ? "curious"
          : "idle";

  const onClose = useCallback(() => setOpen(false), []);

  if (!anchor) return null;

  // Open away from the edges the bird is nearest, so the bar always fits.
  const toLeft = anchor.x > window.innerWidth / 2;
  const above = anchor.y > window.innerHeight / 2;

  return (
    <div
      style={{ left: anchor.x, top: anchor.y, width: ORB, height: ORB }}
      className="pointer-events-none fixed z-50"
    >
      <div
        inert={!open}
        style={{
          transformOrigin: `${above ? "bottom" : "top"} ${toLeft ? "right" : "left"}`,
        }}
        className={`absolute transition-all duration-200 ease-out ${
          toLeft ? "right-0" : "left-0"
        } ${above ? "bottom-full mb-3" : "top-full mt-3"} ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <AiCommandBar
          assets={mediaAssets}
          hasTranscript={words.length > 0}
          open={open}
          placement={placement}
          onDragHandle={onPointerDown}
          onClose={onClose}
        />
      </div>

      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={() => {
          // The press that just ended may have been a drag, not a click.
          if (!wasDragged()) setOpen(true);
        }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-label="Ask Yapper"
        title="Ask Yapper. Drag me anywhere."
        style={{
          // A warm dark disc, not an orange one: the bird is already the brand
          // gradient, and orange on orange loses him.
          background:
            "color-mix(in srgb, var(--sg-accent) 14%, var(--sg-surface))",
          boxShadow: dragging
            ? "0 14px 34px -6px color-mix(in srgb, var(--sg-accent) 55%, transparent)"
            : "0 8px 24px -8px color-mix(in srgb, var(--sg-accent) 50%, transparent)",
        }}
        className={`absolute inset-0 grid place-items-center rounded-full ring-1 ring-[color:var(--sg-accent)]/45 transition-[transform,opacity,box-shadow] duration-200 ease-out ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        } ${
          open
            ? "pointer-events-none scale-50 opacity-0"
            : "pointer-events-auto scale-100 opacity-100 hover:scale-110"
        } ${
          !open && !dragging
            ? "animate-[assistant-bob_4.5s_ease-in-out_infinite]"
            : ""
        }`}
      >
        <BirdMascot
          expression={expression}
          talking={thinking}
          size={38}
          className="pointer-events-none"
        />
        {thinking && (
          <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-[color:var(--sg-accent)]/60" />
        )}
      </button>
    </div>
  );
}
