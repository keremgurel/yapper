import { describe, expect, it } from "vitest";
import { resolutionChoices } from "@/lib/studio/export/resolutions";
import type { StudioSource } from "@/lib/studio/types";

function source(width: number, height: number): StudioSource {
  return { url: "blob:v", name: "clip", duration: 10, width, height };
}

const PORTRAIT = 9 / 16;
const LANDSCAPE = 16 / 9;

describe("resolutionChoices", () => {
  it("always offers Original first", () => {
    const choices = resolutionChoices(source(1080, 1920), PORTRAIT);
    expect(choices[0]).toMatchObject({ id: "original", label: "Original" });
  });

  it("hints the exact portrait and landscape pixel sizes", () => {
    expect(resolutionChoices(source(1080, 1920), PORTRAIT)[0].hint).toBe(
      "1080 x 1920",
    );
    expect(resolutionChoices(source(1920, 1080), LANDSCAPE)[0].hint).toBe(
      "1920 x 1080",
    );
  });

  it("only offers steps smaller than the source, never an upscale", () => {
    const small = resolutionChoices(source(720, 1280), PORTRAIT);
    // A 720-short source can't offer 1080p or 720p (would upscale/equal).
    expect(small.map((c) => c.id)).toEqual(["original"]);
    const big = resolutionChoices(source(1440, 2560), PORTRAIT);
    expect(big.map((c) => c.id)).toEqual(["original", "1080p", "720p"]);
  });

  it("clamps the Original hint to the encoder limit for oversized sources", () => {
    // An 8K-short portrait source: the long side would be 7680, past the 3840
    // encoder cap, so the real export scales to 2160 x 3840. The hint must show
    // what actually exports, not the unclamped 4320 x 7680.
    expect(resolutionChoices(source(4320, 7680), PORTRAIT)[0].hint).toBe(
      "2160 x 3840",
    );
  });
});
