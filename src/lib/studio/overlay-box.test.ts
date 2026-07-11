import { describe, expect, it } from "vitest";
import { FULL_FRAME, fitBox, mediaAspect } from "@/lib/studio/overlay-box";

const PORTRAIT = 9 / 16;
const LANDSCAPE = 16 / 9;

describe("fitBox", () => {
  it("fills the stage when the shapes match", () => {
    expect(fitBox(LANDSCAPE, LANDSCAPE)).toEqual(FULL_FRAME);
  });

  it("letterboxes a wide clip on a tall stage", () => {
    const box = fitBox(LANDSCAPE, PORTRAIT);
    expect(box.w).toBe(1);
    expect(box.h).toBeCloseTo(9 / 16 / (16 / 9), 6); // 0.3164
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo((1 - box.h) / 2, 6);
  });

  it("pillarboxes a tall clip on a wide stage", () => {
    const box = fitBox(PORTRAIT, LANDSCAPE);
    expect(box.h).toBe(1);
    expect(box.w).toBeCloseTo(9 / 16 / (16 / 9), 6);
    expect(box.y).toBe(0);
    expect(box.x).toBeCloseTo((1 - box.w) / 2, 6);
  });

  it("keeps the media's own aspect, which is the whole point", () => {
    // The box's aspect, measured on the stage, is the media's aspect again.
    const stage = PORTRAIT;
    const box = fitBox(LANDSCAPE, stage);
    expect((box.w / box.h) * stage).toBeCloseTo(LANDSCAPE, 6);
  });

  it("never leaves the stage", () => {
    for (const media of [0.2, 0.5, 1, 2, 5]) {
      const box = fitBox(media, PORTRAIT);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1);
      expect(box.y + box.h).toBeLessThanOrEqual(1);
    }
  });

  it("centres what it shrinks", () => {
    const box = fitBox(1, LANDSCAPE);
    expect(box.x).toBeCloseTo(1 - (box.x + box.w), 6);
  });

  it("fills the stage when the media never reported a shape", () => {
    expect(fitBox(undefined, PORTRAIT)).toEqual(FULL_FRAME);
    expect(fitBox(NaN, PORTRAIT)).toEqual(FULL_FRAME);
    expect(fitBox(LANDSCAPE, 0)).toEqual(FULL_FRAME);
  });
});

describe("mediaAspect", () => {
  it("divides width by height", () => {
    expect(mediaAspect({ width: 1920, height: 1080 })).toBeCloseTo(16 / 9, 6);
  });

  it("is undefined when either side is missing or zero", () => {
    expect(mediaAspect({ width: 1920 })).toBeUndefined();
    expect(mediaAspect({ height: 1080 })).toBeUndefined();
    expect(mediaAspect({ width: 0, height: 1080 })).toBeUndefined();
    expect(mediaAspect({})).toBeUndefined();
  });
});
