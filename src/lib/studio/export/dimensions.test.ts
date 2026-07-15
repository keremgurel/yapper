import { describe, expect, it } from "vitest";
import { outputDimensions, scaleLongSide } from "./dimensions";
import type { StudioSource } from "@/lib/studio/types";

function source(width: number, height: number): StudioSource {
  return { kind: "video", url: "blob:x", width, height } as StudioSource;
}

const isEven = (n: number) => n % 2 === 0;

describe("outputDimensions", () => {
  it("shapes the frame from the project aspect at the source short side", () => {
    // Portrait 9:16 from a 1080x1920 source.
    expect(outputDimensions(source(1080, 1920), 9 / 16)).toEqual({
      width: 1080,
      height: 1920,
    });
    // Landscape 16:9 from a 1920x1080 source.
    expect(outputDimensions(source(1920, 1080), 16 / 9)).toEqual({
      width: 1920,
      height: 1080,
    });
    // Square.
    expect(outputDimensions(source(1080, 1920), 1)).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("falls back to 1080 short side when the source has no dimensions", () => {
    expect(outputDimensions(null, 9 / 16)).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("never upscales past the source short side", () => {
    // A 720-tall source asked for a 1080 short side stays at 720.
    expect(outputDimensions(source(720, 1280), 9 / 16, 1080)).toEqual({
      width: 720,
      height: 1280,
    });
  });

  it("clamps the long side to the encoder limit and keeps even dims", () => {
    const d = outputDimensions(source(4000, 8000), 9 / 16);
    expect(Math.max(d.width, d.height)).toBe(3840);
    expect(isEven(d.width) && isEven(d.height)).toBe(true);
  });

  it("always returns even dimensions", () => {
    const d = outputDimensions(source(1081, 1921), 1);
    expect(isEven(d.width) && isEven(d.height)).toBe(true);
  });
});

describe("scaleLongSide", () => {
  it("scales down to the target, preserving even dims", () => {
    expect(scaleLongSide({ width: 3840, height: 2160 }, 1080)).toEqual({
      width: 1080,
      height: 608,
    });
  });

  it("never upscales a size already within the target", () => {
    expect(scaleLongSide({ width: 100, height: 200 }, 1080)).toEqual({
      width: 100,
      height: 200,
    });
  });

  it("evens out an odd size even when no scaling is needed", () => {
    // The contract is "always even"; the no-scale path must honor it too.
    expect(scaleLongSide({ width: 1081, height: 1921 }, 3840)).toEqual({
      width: 1082,
      height: 1922,
    });
  });
});
