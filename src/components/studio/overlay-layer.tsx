"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import OverlayCropEditor from "@/components/studio/overlay-crop-editor";
import OverlayMenu, { type MenuAnchor } from "@/components/studio/overlay-menu";
import { FULL_CROP, cropStyle, isFullCrop } from "@/lib/studio/crop";
import { FULL_FRAME, fitBox, mediaAspect } from "@/lib/studio/overlay-box";
import { paintOrder } from "@/lib/studio/tracks";
import type { Overlay, OverlayRect } from "@/lib/studio/types";

function clamp01(v: number, max = 1): number {
  return Math.max(0, Math.min(max, v));
}

const MIN = 0.1; // minimum overlay size (fraction of stage)
const SNAP = 0.012; // snap distance (fraction of stage) — like Canva's magnet

/** Active alignment guides while dragging, as stage fractions (0..1). */
export interface Guides {
  v: number[];
  h: number[];
}

/**
 * Snap one span (its start / center / end) to the nearest target line. Returns
 * the delta to shift the span by and the guide line it snapped to, or null.
 */
function snapSpan(
  start: number,
  size: number,
  targets: number[],
): { delta: number; guide: number } | null {
  const edges = [start, start + size / 2, start + size];
  let best: { delta: number; guide: number } | null = null;
  for (const e of edges) {
    for (const t of targets) {
      const delta = t - e;
      if (
        Math.abs(delta) <= SNAP &&
        (!best || Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, guide: t };
      }
    }
  }
  return best;
}

/** Snap a single edge to the nearest target line, or null if none are close. */
function snapEdge(pos: number, targets: number[]): number | null {
  let best: number | null = null;
  for (const t of targets) {
    if (
      Math.abs(t - pos) <= SNAP &&
      (best === null || Math.abs(t - pos) < Math.abs(best - pos))
    ) {
      best = t;
    }
  }
  return best;
}

type Corner = "tl" | "tr" | "bl" | "br";

// Centred exactly on the box's corners. The media is clipped by an inner
// wrapper rather than by the box itself, and the stage no longer clips its
// chrome, so a handle sitting half outside the overlay is still fully drawn.
const CORNERS: { id: Corner; className: string; cursor: string }[] = [
  { id: "tl", className: "top-0 left-0", cursor: "cursor-nwse-resize" },
  { id: "tr", className: "top-0 right-0", cursor: "cursor-nesw-resize" },
  { id: "bl", className: "bottom-0 left-0", cursor: "cursor-nesw-resize" },
  { id: "br", className: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
];

// Half a handle, so translating by this centres it on the corner it names.
const HANDLE_OFFSET: Record<Corner, string> = {
  tl: "translate(-50%, -50%)",
  tr: "translate(50%, -50%)",
  bl: "translate(-50%, 50%)",
  br: "translate(50%, 50%)",
};

interface DragState {
  mode: "move" | "resize";
  corner?: Corner;
  startX: number;
  startY: number;
  rect: OverlayRect;
}

function OverlayBox({
  overlay,
  local,
  playing,
  selected,
  others,
  stageAspect,
  aspect,
  onSelect,
  onMenu,
  layerRef,
  onCommit,
  onGuides,
}: {
  overlay: Overlay;
  local: number;
  playing: boolean;
  selected: boolean;
  others: OverlayRect[];
  /** The stage's width / height, which the box's fractions are measured in. */
  stageAspect: number;
  /** The media's own width / height, or undefined if it never reported one. */
  aspect: number | undefined;
  onSelect: () => void;
  onMenu: (e: React.MouseEvent) => void;
  layerRef: React.RefObject<HTMLDivElement | null>;
  onCommit: (rect: OverlayRect) => void;
  onGuides: (guides: Guides | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [live, setLive] = useState<OverlayRect | null>(null);

  const base: OverlayRect = {
    x: overlay.x ?? 0,
    y: overlay.y ?? 0,
    w: overlay.w ?? 1,
    h: overlay.h ?? 1,
  };
  const r = live ?? base;

  const target = overlay.sourceStart + local;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    // Gate seek + play behind metadata: seeking/playing before the overlay's
    // media has loaded flashes its frame 0 instead of the intended in-point.
    const sync = () => {
      if (cancelled) return;
      if (Math.abs(v.currentTime - target) > 0.12) v.currentTime = target;
      if (playing) {
        if (v.paused) void v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    };
    if (v.readyState >= 1) sync();
    else v.addEventListener("loadedmetadata", sync, { once: true });
    return () => {
      cancelled = true;
      v.removeEventListener("loadedmetadata", sync);
    };
  }, [target, playing]);

  const start =
    (mode: "move" | "resize", corner?: Corner) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();
      dragRef.current = {
        mode,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        rect: base,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

  // Alignment targets: the stage's own edges + center, plus every other
  // overlay's edges + center. Snapping to these makes centering and lining up
  // with another overlay click into place, Canva-style.
  const vTargets = [
    0,
    0.5,
    1,
    ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]),
  ];
  const hTargets = [
    0,
    0.5,
    1,
    ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]),
  ];

  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const box = layerRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    if (d.mode === "move") {
      let nx = clamp01(d.rect.x + dx, 1 - d.rect.w);
      let ny = clamp01(d.rect.y + dy, 1 - d.rect.h);
      const { w, h } = d.rect;
      const gv: number[] = [];
      const gh: number[] = [];
      const sx = snapSpan(nx, w, vTargets);
      if (sx) {
        nx = clamp01(nx + sx.delta, 1 - w);
        gv.push(sx.guide);
      }
      const sy = snapSpan(ny, h, hTargets);
      if (sy) {
        ny = clamp01(ny + sy.delta, 1 - h);
        gh.push(sy.guide);
      }
      onGuides(gv.length || gh.length ? { v: gv, h: gh } : null);
      setLive({ x: nx, y: ny, w, h });
      return;
    }
    // Resize: grow/shrink from the dragged corner, keeping the opposite edge fixed.
    const { x, y, w, h } = d.rect;
    const c = d.corner ?? "br";
    let nx = x;
    let ny = y;
    let nw = w;
    let nh = h;
    if (c === "br" || c === "tr") {
      nw = Math.max(MIN, Math.min(1 - x, w + dx));
    } else {
      nw = Math.max(MIN, Math.min(x + w, w - dx));
      nx = x + w - nw;
    }
    if (c === "br" || c === "bl") {
      nh = Math.max(MIN, Math.min(1 - y, h + dy));
    } else {
      nh = Math.max(MIN, Math.min(y + h, h - dy));
      ny = y + h - nh;
    }
    // Snap the two moving edges to the same targets, showing a guide when they do.
    const gv: number[] = [];
    const gh: number[] = [];
    const rightMoving = c === "br" || c === "tr";
    const vEdge = rightMoving ? nx + nw : nx;
    const sv = snapEdge(vEdge, vTargets);
    if (sv !== null) {
      if (rightMoving) {
        nw = Math.max(MIN, Math.min(1 - nx, sv - nx));
      } else {
        const right = x + w; // opposite edge stays fixed
        nx = Math.max(0, Math.min(right - MIN, sv));
        nw = right - nx;
      }
      gv.push(sv);
    }
    const bottomMoving = c === "br" || c === "bl";
    const hEdge = bottomMoving ? ny + nh : ny;
    const sh = snapEdge(hEdge, hTargets);
    if (sh !== null) {
      if (bottomMoving) {
        nh = Math.max(MIN, Math.min(1 - ny, sh - ny));
      } else {
        const bottom = y + h; // opposite edge stays fixed
        ny = Math.max(0, Math.min(bottom - MIN, sh));
        nh = bottom - ny;
      }
      gh.push(sh);
    }
    onGuides(gv.length || gh.length ? { v: gv, h: gh } : null);
    setLive({ x: nx, y: ny, w: nw, h: nh });
  };

  const end = (e: React.PointerEvent) => {
    if (dragRef.current) {
      setLive((l) => {
        if (l) onCommit(l);
        return null;
      });
      onGuides(null);
      dragRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Where the media sits inside its box: the crop rectangle, covered into the
  // box. Without a known aspect there is no crop math to do, so it falls back
  // to plain object-cover, which is what an uncropped overlay always was.
  const style =
    aspect && r.w > 0 && r.h > 0
      ? cropStyle(overlay.crop ?? FULL_CROP, aspect, (r.w / r.h) * stageAspect)
      : null;
  const mediaStyle = style
    ? {
        left: `${style.left * 100}%`,
        top: `${style.top * 100}%`,
        width: `${style.width * 100}%`,
        height: `${style.height * 100}%`,
      }
    : undefined;
  const mediaClass = style
    ? "pointer-events-none absolute max-w-none object-fill"
    : "pointer-events-none h-full w-full object-cover";

  return (
    <div
      onPointerDown={start("move")}
      onPointerMove={move}
      onPointerUp={end}
      onContextMenu={onMenu}
      style={{
        left: `${r.x * 100}%`,
        top: `${r.y * 100}%`,
        width: `${r.w * 100}%`,
        height: `${r.h * 100}%`,
      }}
      className={`pointer-events-auto absolute cursor-move rounded-[2px] ${
        selected
          ? "ring-2 ring-cyan-400"
          : "ring-1 ring-white/20 hover:ring-white/60"
      }`}
    >
      {/* Only the media is clipped, so the corner handles can overhang. */}
      <div className="absolute inset-0 overflow-hidden rounded-[2px]">
        {overlay.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlay.url}
            alt=""
            draggable={false}
            style={mediaStyle}
            className={mediaClass}
          />
        ) : (
          <video
            ref={videoRef}
            src={overlay.url}
            muted={overlay.muted ?? true}
            playsInline
            style={mediaStyle}
            className={mediaClass}
          />
        )}
      </div>
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner.id}
            onPointerDown={start("resize", corner.id)}
            onPointerMove={move}
            onPointerUp={end}
            style={{ transform: HANDLE_OFFSET[corner.id] }}
            className={`absolute z-10 h-3.5 w-3.5 rounded-full border-2 border-cyan-400 bg-white shadow ${corner.className} ${corner.cursor}`}
          />
        ))}
    </div>
  );
}

/**
 * Composites upper video/image tracks over the base preview at the master clock.
 * A higher track paints over a lower one. Tap an overlay to select it, then drag
 * to move or use the corner handles to resize. Right-click it for what to do
 * with the picture inside the box: crop it, fit it, fill the frame.
 */
const rectOf = (o: Overlay): OverlayRect => ({
  x: o.x ?? 0,
  y: o.y ?? 0,
  w: o.w ?? 1,
  h: o.h ?? 1,
});

export default function OverlayLayer({
  overlays,
  masterTime,
  playing,
}: {
  overlays: Overlay[];
  masterTime: number;
  playing: boolean;
}) {
  const { setOverlayRect, setOverlayCrop, mediaAssets, aspect } = useStudio();
  const layerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides | null>(null);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);

  // An overlay's media is a library asset, and that is where its shape is known.
  const aspectOf = (o: Overlay) =>
    mediaAspect(mediaAssets.find((m) => m.url === o.url) ?? {});

  const openMenu = (o: Overlay) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = layerRef.current?.getBoundingClientRect();
    if (!box) return;
    setSelectedId(o.id);
    setMenu({
      id: o.id,
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    });
  };

  const menuOverlay = overlays.find((o) => o.id === menu?.id) ?? null;
  const cropOverlay = overlays.find((o) => o.id === cropping) ?? null;
  const cropAspect = cropOverlay ? aspectOf(cropOverlay) : undefined;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      {paintOrder(overlays).map((o) => {
        if (o.hidden) return null;
        const local = masterTime - o.start;
        if (local < 0 || local >= o.duration) return null;
        return (
          <OverlayBox
            key={o.id}
            overlay={o}
            local={local}
            playing={playing}
            selected={selectedId === o.id}
            others={overlays
              .filter((x) => x.id !== o.id && !x.hidden)
              .map(rectOf)}
            stageAspect={aspect}
            aspect={aspectOf(o)}
            onSelect={() => setSelectedId(o.id)}
            onMenu={openMenu(o)}
            layerRef={layerRef}
            onCommit={(rect) => setOverlayRect(o.id, rect)}
            onGuides={setGuides}
          />
        );
      })}

      {menu && menuOverlay && (
        <OverlayMenu
          anchor={menu}
          cropped={!isFullCrop(menuOverlay.crop)}
          onCrop={() => {
            setCropping(menu.id);
            setMenu(null);
          }}
          onFit={() => {
            setOverlayRect(menu.id, fitBox(aspectOf(menuOverlay), aspect));
            setMenu(null);
          }}
          onFill={() => {
            setOverlayRect(menu.id, FULL_FRAME);
            setMenu(null);
          }}
          onResetCrop={() => {
            setOverlayCrop(menu.id, FULL_CROP);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {cropOverlay && cropAspect && (
        <OverlayCropEditor
          overlay={cropOverlay}
          aspect={cropAspect}
          onChange={(crop, gesture) =>
            setOverlayCrop(cropOverlay.id, crop, gesture)
          }
          onClose={() => setCropping(null)}
        />
      )}

      {/* Alignment guides shown live while dragging (Canva-style). */}
      {guides?.v.map((x, i) => (
        <span
          key={`v${i}`}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-fuchsia-400"
          style={{ left: `${x * 100}%` }}
        />
      ))}
      {guides?.h.map((y, i) => (
        <span
          key={`h${i}`}
          className="pointer-events-none absolute right-0 left-0 h-px bg-fuchsia-400"
          style={{ top: `${y * 100}%` }}
        />
      ))}
    </div>
  );
}
