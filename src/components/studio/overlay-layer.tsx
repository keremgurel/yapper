"use client";

import { useEffect, useRef } from "react";
import type { Overlay } from "@/lib/studio/types";

function OverlayVideo({
  overlay,
  local,
  playing,
}: {
  overlay: Overlay;
  local: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - local) > 0.3) v.currentTime = local;
    if (playing) {
      if (v.paused) void v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  }, [local, playing]);
  return (
    <video
      ref={ref}
      src={overlay.url}
      muted
      playsInline
      className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
    />
  );
}

/** Composites image/video overlays over the base preview at the master clock. */
export default function OverlayLayer({
  overlays,
  masterTime,
  playing,
}: {
  overlays: Overlay[];
  masterTime: number;
  playing: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {overlays.map((o) => {
        const local = masterTime - o.start;
        if (local < 0 || local >= o.duration) return null;
        if (o.kind === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={o.id}
              src={o.url}
              alt=""
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            />
          );
        }
        return (
          <OverlayVideo
            key={o.id}
            overlay={o}
            local={local}
            playing={playing}
          />
        );
      })}
    </div>
  );
}
