import { snapEdge } from "@/lib/studio/align";
import type { OverlayRect } from "@/lib/studio/types";

export type Corner = "tl" | "tr" | "bl" | "br";

/** Minimum overlay size, as a fraction of the stage. */
export const MIN_OVERLAY = 0.1;

/**
 * Resize a rect by dragging `corner` by (dx, dy) in stage fractions, holding the
 * two opposite edges fixed. The box stays within [0, 1] on both axes and never
 * shrinks below MIN_OVERLAY. Pure.
 */
export function resizeRect(
  rect: OverlayRect,
  corner: Corner,
  dx: number,
  dy: number,
): OverlayRect {
  const { x, y, w, h } = rect;
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;
  if (corner === "br" || corner === "tr") {
    // Right edge moves; left edge (x) stays, so width caps at the stage edge.
    nw = Math.max(MIN_OVERLAY, Math.min(1 - x, w + dx));
  } else {
    // Left edge moves; right edge (x + w) stays, so width caps at it.
    nw = Math.max(MIN_OVERLAY, Math.min(x + w, w - dx));
    nx = x + w - nw;
  }
  if (corner === "br" || corner === "bl") {
    nh = Math.max(MIN_OVERLAY, Math.min(1 - y, h + dy));
  } else {
    nh = Math.max(MIN_OVERLAY, Math.min(y + h, h - dy));
    ny = y + h - nh;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Snap the two moving edges of a mid-resize rect onto the nearest guide lines.
 * `rect` is the raw resize result; `orig` supplies the fixed opposite edges so a
 * left/top snap keeps the far edge pinned exactly where it started. Returns the
 * adjusted rect and the guide lines it landed on. Pure.
 */
export function snapResize(
  rect: OverlayRect,
  orig: OverlayRect,
  corner: Corner,
  vTargets: number[],
  hTargets: number[],
): { rect: OverlayRect; guides: { v: number[]; h: number[] } } {
  let { x: nx, y: ny, w: nw, h: nh } = rect;
  const v: number[] = [];
  const h: number[] = [];

  const rightMoving = corner === "br" || corner === "tr";
  const vEdge = rightMoving ? nx + nw : nx;
  const sv = snapEdge(vEdge, vTargets);
  if (sv !== null) {
    if (rightMoving) {
      nw = Math.max(MIN_OVERLAY, Math.min(1 - nx, sv - nx));
    } else {
      const right = orig.x + orig.w; // opposite edge stays fixed
      nx = Math.max(0, Math.min(right - MIN_OVERLAY, sv));
      nw = right - nx;
    }
    v.push(sv);
  }

  const bottomMoving = corner === "br" || corner === "bl";
  const hEdge = bottomMoving ? ny + nh : ny;
  const sh = snapEdge(hEdge, hTargets);
  if (sh !== null) {
    if (bottomMoving) {
      nh = Math.max(MIN_OVERLAY, Math.min(1 - ny, sh - ny));
    } else {
      const bottom = orig.y + orig.h; // opposite edge stays fixed
      ny = Math.max(0, Math.min(bottom - MIN_OVERLAY, sh));
      nh = bottom - ny;
    }
    h.push(sh);
  }

  return { rect: { x: nx, y: ny, w: nw, h: nh }, guides: { v, h } };
}
