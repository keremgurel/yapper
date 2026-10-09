/**
 * Where the floating Chirpy sits, as a top-left point in the viewport.
 *
 * Mirrors the Mac app's AssistantAnchor: it goes exactly where it was put,
 * and a smaller window pulls it back inside rather than stranding it off the
 * edge. The open panel is placed relative to the bird, on whichever side has
 * the room, so dragging the bird is the only placement the creator manages.
 */
export interface ChirpyPoint {
  x: number;
  y: number;
}

export interface ChirpySize {
  width: number;
  height: number;
}

/** Close enough to the edge to feel docked, far enough that the shadow and
 * the grab area never fall off the window. */
export const CHIRPY_MARGIN = 16;

export function clampToViewport(
  point: ChirpyPoint,
  size: ChirpySize,
  bounds: ChirpySize,
): ChirpyPoint {
  // A window smaller than the thing being placed has nowhere legal to put it,
  // so the margin gives way rather than inverting the range.
  const maxX = Math.max(
    CHIRPY_MARGIN,
    bounds.width - size.width - CHIRPY_MARGIN,
  );
  const maxY = Math.max(
    CHIRPY_MARGIN,
    bounds.height - size.height - CHIRPY_MARGIN,
  );
  return {
    x: Math.min(maxX, Math.max(CHIRPY_MARGIN, point.x)),
    y: Math.min(maxY, Math.max(CHIRPY_MARGIN, point.y)),
  };
}

/** Before it has ever been dragged: bottom right, out of the way. */
export function initialAnchor(
  size: ChirpySize,
  bounds: ChirpySize,
): ChirpyPoint {
  return clampToViewport(
    {
      x: bounds.width - size.width - CHIRPY_MARGIN,
      y: bounds.height - size.height - CHIRPY_MARGIN,
    },
    size,
    bounds,
  );
}

/** Which way things that come out of the bird should open: toward the middle
 * of the window, where there is room. */
export function facing(
  anchor: ChirpyPoint,
  size: ChirpySize,
  bounds: ChirpySize,
) {
  return {
    right: anchor.x + size.width / 2 > bounds.width / 2,
    bottom: anchor.y + size.height / 2 > bounds.height / 2,
  };
}

/** Where the bird sits once it has flown into the open panel's corner, and
 * how small it gets there. */
export const DOCK_INSET = 8;
export const DOCK_SCALE = 44 / 72;

/**
 * Where the open panel goes. It grows out of the bird's own corner: a bird on
 * the right half shares the panel's right edge, a bird low on the screen
 * shares its bottom edge, so the panel covers the spot the bird was in and
 * the bird flies a short way into its top-left corner. Always inside the
 * window, shrinking only when the window is smaller than the panel.
 */
export function panelFrame(
  anchor: ChirpyPoint,
  bird: ChirpySize,
  desired: ChirpySize,
  bounds: ChirpySize,
): ChirpyPoint & ChirpySize & { origin: string } {
  const side = facing(anchor, bird, bounds);
  const width = Math.min(desired.width, bounds.width - 2 * CHIRPY_MARGIN);
  const height = Math.min(desired.height, bounds.height - 2 * CHIRPY_MARGIN);
  const point = clampToViewport(
    {
      x: side.right ? anchor.x + bird.width - width : anchor.x,
      y: side.bottom ? anchor.y + bird.height - height : anchor.y,
    },
    { width, height },
    bounds,
  );
  return {
    ...point,
    width,
    height,
    origin: `${side.right ? "right" : "left"} ${side.bottom ? "bottom" : "top"}`,
  };
}

const STORAGE_KEY = "yapper:chirpy-anchor";

export function readStoredAnchor(): ChirpyPoint | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChirpyPoint>;
    return typeof parsed.x === "number" && typeof parsed.y === "number"
      ? { x: parsed.x, y: parsed.y }
      : null;
  } catch {
    return null;
  }
}

export function storeAnchor(point: ChirpyPoint) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(point));
  } catch {
    // Storage can be blocked; the bird still sits where it was dropped
    // until the next reload.
  }
}
