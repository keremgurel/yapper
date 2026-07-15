import { describe, expect, it } from "vitest";
import {
  MIN_OVERLAY,
  resizeRect,
  snapResize,
} from "@/lib/studio/overlay-resize";
import type { OverlayRect } from "@/lib/studio/types";

const rect = (x: number, y: number, w: number, h: number): OverlayRect => ({
  x,
  y,
  w,
  h,
});

// A centered box, well clear of the stage edges so clamps don't interfere.
const BOX = rect(0.2, 0.2, 0.4, 0.4);

describe("resizeRect", () => {
  it("grows from the bottom-right, holding the top-left corner fixed", () => {
    expect(resizeRect(BOX, "br", 0.1, 0.1)).toEqual(rect(0.2, 0.2, 0.5, 0.5));
  });

  it("drags the top-left inward while pinning the bottom-right edge", () => {
    // Right/bottom edge stays at 0.6 (0.2 + 0.4); the box shrinks from 0.4 to 0.3.
    const r = resizeRect(BOX, "tl", 0.1, 0.1);
    expect(r.w).toBeCloseTo(0.3, 5);
    expect(r.h).toBeCloseTo(0.3, 5);
    expect(r.x).toBeCloseTo(0.3, 5);
    expect(r.y).toBeCloseTo(0.3, 5);
    expect(r.x + r.w).toBeCloseTo(0.6, 5);
    expect(r.y + r.h).toBeCloseTo(0.6, 5);
  });

  it("never shrinks below the minimum size", () => {
    const r = resizeRect(BOX, "br", -1, -1);
    expect(r.w).toBe(MIN_OVERLAY);
    expect(r.h).toBe(MIN_OVERLAY);
  });

  it("clamps growth to the stage edge", () => {
    const r = resizeRect(BOX, "br", 1, 1);
    expect(r.w).toBeCloseTo(0.8, 5); // 1 - x
    expect(r.x + r.w).toBeCloseTo(1, 5);
  });
});

describe("snapResize", () => {
  it("snaps the moving right/bottom edges onto nearby guides", () => {
    // Raw resize put the right edge at 0.7; a guide at 0.705 pulls it there.
    const raw = rect(0.2, 0.2, 0.5, 0.5); // right/bottom at 0.7
    const { rect: r, guides } = snapResize(raw, BOX, "br", [0.705], [0.705]);
    expect(r.x).toBe(0.2); // left edge unmoved
    expect(r.x + r.w).toBeCloseTo(0.705, 5);
    expect(r.y + r.h).toBeCloseTo(0.705, 5);
    expect(guides.v).toEqual([0.705]);
    expect(guides.h).toEqual([0.705]);
  });

  it("snaps a moving left edge while pinning the original right edge", () => {
    // tl drag left the box at x 0.3 (right edge 0.6). A guide at 0.305 nudges
    // the left edge; the right edge must stay exactly at 0.6.
    const raw = rect(0.3, 0.3, 0.3, 0.3);
    const { rect: r, guides } = snapResize(raw, BOX, "tl", [0.305], []);
    expect(r.x).toBeCloseTo(0.305, 5);
    expect(r.x + r.w).toBeCloseTo(0.6, 5); // right edge pinned to orig
    expect(guides.v).toEqual([0.305]);
  });

  it("leaves the rect untouched when no guide is in range", () => {
    const raw = rect(0.2, 0.2, 0.5, 0.5);
    const { rect: r, guides } = snapResize(raw, BOX, "br", [0.9], [0.9]);
    expect(r).toEqual(raw);
    expect(guides.v).toEqual([]);
    expect(guides.h).toEqual([]);
  });
});
