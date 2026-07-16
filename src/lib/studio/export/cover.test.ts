import { describe, expect, it } from "vitest";
import { coverSourceRect } from "@/lib/studio/export/cover";

describe("coverSourceRect", () => {
  it("crops the sides of a square source filling a portrait box", () => {
    // object-cover fills 100x200 from a 1000x1000 source: keep full height,
    // sample a narrower centered column. object-contain (min scale) would not.
    expect(coverSourceRect(1000, 1000, 100, 200)).toEqual({
      sx: 250,
      sy: 0,
      sw: 500,
      sh: 1000,
    });
  });

  it("crops the sides of a landscape source filling a square box", () => {
    expect(coverSourceRect(1000, 500, 100, 100)).toEqual({
      sx: 250,
      sy: 0,
      sw: 500,
      sh: 500,
    });
  });

  it("crops the top and bottom of a tall source filling a wide box", () => {
    expect(coverSourceRect(500, 1000, 200, 100)).toEqual({
      sx: 0,
      sy: 375,
      sw: 500,
      sh: 250,
    });
  });

  it("samples the whole source when the aspect ratios already match", () => {
    expect(coverSourceRect(1000, 500, 200, 100)).toEqual({
      sx: 0,
      sy: 0,
      sw: 1000,
      sh: 500,
    });
  });

  it("returns a safe rect for degenerate (zero or negative) dimensions", () => {
    expect(coverSourceRect(0, 100, 50, 50)).toEqual({
      sx: 0,
      sy: 0,
      sw: 1,
      sh: 100,
    });
    expect(coverSourceRect(200, 200, 0, 50)).toEqual({
      sx: 0,
      sy: 0,
      sw: 200,
      sh: 200,
    });
  });
});
