import type { Caption } from "@/lib/studio/types";

/** A caption move/resize, in stage fractions. */
export interface CaptionLayout {
  x?: number;
  y?: number;
  w?: number;
  scale?: number;
}

/**
 * Resolve a caption style change (font, scale, case) against the Apply-to-all
 * toggle. With apply-all ON the change is going to the GLOBAL style, so every
 * caption's matching per-caption override is cleared, or it would keep shadowing
 * the new global value. With it OFF the change is written as an override on just
 * the selected captions. Off with nothing selected is a no-op, returned BY
 * REFERENCE so the history reducer records nothing.
 */
export function applyStyleToCaptions(
  captions: Caption[],
  applyAll: boolean,
  selectedIds: Set<string>,
  perCaption: Partial<Caption>,
): Caption[] {
  if (applyAll) {
    const keys = Object.keys(perCaption) as (keyof Caption)[];
    return captions.map((c) => {
      const next = { ...c };
      for (const k of keys) delete next[k];
      return next;
    });
  }
  if (selectedIds.size === 0) return captions;
  return captions.map((c) =>
    selectedIds.has(c.id) ? { ...c, ...perCaption } : c,
  );
}

/**
 * The caption-layer half of a move/resize (the global-style patch stays in the
 * caller). With apply-all ON the layout went to the global style, so every
 * caption drops the overrides for exactly the fields that changed. With it OFF
 * the layout is written onto the one caption `id`.
 */
export function applyLayoutToCaptions(
  captions: Caption[],
  applyAll: boolean,
  id: string,
  layout: CaptionLayout,
): Caption[] {
  if (applyAll) {
    return captions.map((c) => ({
      ...c,
      x: layout.x != null ? undefined : c.x,
      y: layout.y != null ? undefined : c.y,
      w: layout.w != null ? undefined : c.w,
      scale: layout.scale != null ? undefined : c.scale,
    }));
  }
  return captions.map((c) => (c.id === id ? { ...c, ...layout } : c));
}
