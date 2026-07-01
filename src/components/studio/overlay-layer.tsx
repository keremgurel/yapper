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
  const target = overlay.sourceStart + local;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    if (playing) {
      if (v.paused) void v.play().catch(() => {});
    } else if (!v.paused) {
      v.pause();
    }
  }, [target, playing]);
  return (
    <video
      ref={ref}
      src={overlay.url}
      muted={overlay.muted ?? true}
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/**
 * Composites upper video/image tracks full-frame over the base preview at the
 * master clock. Later overlays render on top, so the topmost track wins.
 */
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
        if (o.hidden) return null;
        const local = masterTime - o.start;
        if (local < 0 || local >= o.duration) return null;
        if (o.kind === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={o.id}
              src={o.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
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
