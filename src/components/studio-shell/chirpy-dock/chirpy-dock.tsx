"use client";

import { forwardRef, type ReactNode } from "react";
import type { ChirpyExpression } from "@/components/brand/chirpy";
import {
  facing,
  panelFrame,
} from "@/components/studio-shell/chirpy-dock/chirpy-anchor";
import ChirpyGreetingBubble from "@/components/studio-shell/chirpy-dock/chirpy-greeting-bubble";
import ChirpyLauncher, {
  LAUNCHER_SIZE,
} from "@/components/studio-shell/chirpy-dock/chirpy-launcher";
import { useChirpyDrag } from "@/components/studio-shell/chirpy-dock/use-chirpy-drag";
import { useChirpyGreeting } from "@/components/studio-shell/chirpy-dock/use-chirpy-greeting";
import { useViewport } from "@/components/studio-shell/chirpy-dock/use-viewport";

const BIRD = { width: LAUNCHER_SIZE, height: LAUNCHER_SIZE };

/**
 * Where Chirpy lives on screen: the draggable bird, its one-time hello on
 * Home, and the panel, which opens out of the bird toward the middle of the
 * window wherever the creator has put it.
 */
const ChirpyDock = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    /** True on the surface where the hello may happen (Home). */
    greetHere: boolean;
    expression: ChirpyExpression;
    working: boolean;
    panel: ReactNode;
    onToggle: () => void;
    onOpen: () => void;
  }
>(function ChirpyDock(
  { open, greetHere, expression, working, panel, onToggle, onOpen },
  ref,
) {
  const viewport = useViewport();
  const drag = useChirpyDrag(BIRD, viewport);
  const greeting = useChirpyGreeting(greetHere && !open);
  const anchor = drag.anchor;
  if (!viewport || !anchor) return null;

  const side = facing(anchor, BIRD, viewport);
  const frame = panelFrame(
    anchor,
    BIRD,
    { width: Math.min(560, viewport.width - 32), height: 600 },
    viewport,
  );
  const greetingOnScreen =
    greeting.phase === "showing" || greeting.phase === "leaving";

  return (
    <>
      {open ? (
        <div
          className="pointer-events-none fixed top-0 left-0 z-[60]"
          style={{
            width: frame.width,
            height: frame.height,
            transform: `translate(${frame.x}px, ${frame.y}px)`,
          }}
        >
          {panel}
        </div>
      ) : null}
      <div
        className="pointer-events-none fixed top-0 left-0 z-[61]"
        style={{
          width: BIRD.width,
          height: BIRD.height,
          transform: `translate(${anchor.x}px, ${anchor.y}px)`,
        }}
      >
        <ChirpyLauncher
          ref={ref}
          open={open}
          expression={expression}
          talking={working}
          dancing={greeting.phase === "showing"}
          dragging={drag.dragging}
          drag={drag.handlers}
          onActivate={() => {
            if (drag.wasDrag()) return;
            greeting.dismiss();
            onToggle();
          }}
        />
        {greetingOnScreen ? (
          <ChirpyGreetingBubble
            leaving={greeting.phase === "leaving"}
            right={side.right}
            below={!side.bottom}
            birdSize={LAUNCHER_SIZE}
            onOpen={() => {
              greeting.dismiss();
              onOpen();
            }}
            onGone={greeting.finished}
          />
        ) : null}
      </div>
    </>
  );
});

export default ChirpyDock;
