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
const GAP = 12;

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

/** Shortest the panel may get before it moves beside the bird instead. */
const MIN_PANEL_HEIGHT = 360;

/**
 * Where the open panel goes and how tall it is. It opens out of the bird on
 * whichever side, above or below, has more room, sharing the bird's edge
 * nearest the window side, and shrinks to that room. When neither side has
 * enough height it sits beside the bird at full height instead, so it never
 * covers the bird it came out of.
 */
export function panelFrame(
  anchor: ChirpyPoint,
  bird: ChirpySize,
  desired: ChirpySize,
  bounds: ChirpySize,
): ChirpyPoint & ChirpySize {
  const side = facing(anchor, bird, bounds);
  const above = anchor.y - GAP - CHIRPY_MARGIN;
  const below = bounds.height - (anchor.y + bird.height + GAP) - CHIRPY_MARGIN;
  const room = Math.max(above, below);

  if (room >= Math.min(desired.height, MIN_PANEL_HEIGHT)) {
    const height = Math.min(desired.height, room);
    const point = clampToViewport(
      {
        x: side.right ? anchor.x + bird.width - desired.width : anchor.x,
        y:
          above >= below
            ? anchor.y - GAP - height
            : anchor.y + bird.height + GAP,
      },
      { width: desired.width, height },
      bounds,
    );
    return { ...point, width: desired.width, height };
  }

  const height = Math.min(desired.height, bounds.height - 2 * CHIRPY_MARGIN);
  const point = clampToViewport(
    {
      x: side.right
        ? anchor.x - GAP - desired.width
        : anchor.x + bird.width + GAP,
      y: anchor.y + bird.height / 2 - height / 2,
    },
    { width: desired.width, height },
    bounds,
  );
  return { ...point, width: desired.width, height };
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
