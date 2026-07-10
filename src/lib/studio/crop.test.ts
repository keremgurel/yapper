import { describe, expect, it } from "vitest";
import {
  FULL_CROP,
  clampCrop,
  cropStyle,
  croppedSourceRect,
  isFullCrop,
} from "@/lib/studio/crop";
import { coverSourceRect } from "@/lib/studio/export/cover";
import type { OverlayRect } from "@/lib/studio/types";

describe("clampCrop", () => {
  it("leaves a rectangle that is already inside the media", () => {
    const c = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
    expect(clampCrop(c)).toEqual(c);
  });

  it("pushes a rectangle back inside rather than letting it hang out", () => {
    expect(clampCrop({ x: 0.8, y: -0.3, w: 0.5, h: 0.5 })).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.5,
    });
  });

  it("refuses to shrink past the minimum, or grow past the media", () => {
    expect(clampCrop({ x: 0, y: 0, w: 0.001, h: 4 })).toEqual({
      x: 0,
      y: 0,
      w: 0.05,
      h: 1,
    });
  });
});

describe("isFullCrop", () => {
  it("counts an absent crop as no crop", () => {
    expect(isFullCrop(undefined)).toBe(true);
    expect(isFullCrop(FULL_CROP)).toBe(true);
  });

  it("sees a crop that takes something away", () => {
    expect(isFullCrop({ x: 0, y: 0, w: 0.9, h: 1 })).toBe(false);
    expect(isFullCrop({ x: 0.1, y: 0, w: 1, h: 1 })).toBe(false);
  });
});

describe("croppedSourceRect", () => {
  it("is plain object-cover when nothing is cropped", () => {
    expect(croppedSourceRect(1920, 1080, FULL_CROP, 400, 400)).toEqual(
      coverSourceRect(1920, 1080, 400, 400),
    );
  });

  it("samples inside the crop, never outside it", () => {
    // Crop the right half; the box is the same shape as that half.
    const r = croppedSourceRect(
      1000,
      1000,
      { x: 0.5, y: 0, w: 0.5, h: 1 },
      500,
      1000,
    );
    expect(r).toEqual({ sx: 500, sy: 0, sw: 500, sh: 1000 });
  });

  it("centre-crops what is left when the box is a different shape", () => {
    // The kept half is 500x1000; a square box takes the middle 500x500 of it.
    const r = croppedSourceRect(
      1000,
      1000,
      { x: 0.5, y: 0, w: 0.5, h: 1 },
      400,
      400,
    );
    expect(r).toEqual({ sx: 500, sy: 250, sw: 500, sh: 500 });
  });

  it("falls back to the whole media rather than sampling nothing", () => {
    const r = croppedSourceRect(800, 600, { x: 0, y: 0, w: 0, h: 1 }, 100, 100);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 });
  });
});

describe("cropStyle", () => {
  /**
   * What the box actually shows, in media fractions, given where cropStyle puts
   * the media element. This is the number the export has to agree with.
   */
  const visible = (crop: OverlayRect, media: number, box: number) => {
    const s = cropStyle(crop, media, box);
    return {
      x: -s.left / s.width,
      y: -s.top / s.height,
      w: 1 / s.width,
      h: 1 / s.height,
    };
  };

  const cases: {
    crop: OverlayRect;
    srcW: number;
    srcH: number;
    dest: number;
  }[] = [
    { crop: FULL_CROP, srcW: 1920, srcH: 1080, dest: 1 },
    { crop: FULL_CROP, srcW: 1080, srcH: 1920, dest: 16 / 9 },
    {
      crop: { x: 0.25, y: 0.1, w: 0.5, h: 0.6 },
      srcW: 1600,
      srcH: 900,
      dest: 1,
    },
    {
      crop: { x: 0, y: 0.4, w: 1, h: 0.6 },
      srcW: 640,
      srcH: 640,
      dest: 9 / 16,
    },
    {
      crop: { x: 0.3, y: 0, w: 0.2, h: 1 },
      srcW: 1000,
      srcH: 500,
      dest: 4 / 5,
    },
  ];

  it("shows exactly the pixels the export draws", () => {
    for (const { crop, srcW, srcH, dest } of cases) {
      const media = srcW / srcH;
      const destW = 1000;
      const destH = destW / dest;
      const drawn = croppedSourceRect(srcW, srcH, crop, destW, destH);
      const seen = visible(crop, media, dest);
      expect(seen.x).toBeCloseTo(drawn.sx / srcW, 6);
      expect(seen.y).toBeCloseTo(drawn.sy / srcH, 6);
      expect(seen.w).toBeCloseTo(drawn.sw / srcW, 6);
      expect(seen.h).toBeCloseTo(drawn.sh / srcH, 6);
    }
  });

  it("fills the box exactly when the crop is the box's shape", () => {
    // A 2:1 crop of a square media, in a 2:1 box: no cover overflow either way.
    const s = cropStyle({ x: 0, y: 0.25, w: 1, h: 0.5 }, 1, 2);
    expect(s.width).toBeCloseTo(1, 6);
    expect(s.height).toBeCloseTo(2, 6);
    expect(s.left).toBeCloseTo(0, 6);
    expect(s.top).toBeCloseTo(-0.5, 6);
  });

  it("lays the media out at its own aspect, so nothing is stretched", () => {
    for (const { crop, srcW, srcH, dest } of cases) {
      const s = cropStyle(crop, srcW / srcH, dest);
      // The element's aspect, measured in box pixels, is the media's aspect.
      expect((s.width / s.height) * dest).toBeCloseTo(srcW / srcH, 6);
    }
  });

  it("stays put when the media never reported a shape", () => {
    expect(cropStyle(FULL_CROP, 0, 1)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
  });
});
