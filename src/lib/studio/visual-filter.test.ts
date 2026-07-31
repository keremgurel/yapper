import { describe, expect, it } from "vitest";
import { visualFilterCss } from "@/lib/studio/visual-filter";

describe("visualFilterCss", () => {
  it("leaves the original picture unchanged", () => {
    expect(visualFilterCss({ id: "original", strength: 1 })).toBe(
      "brightness(1) contrast(1) saturate(1) sepia(0) hue-rotate(0deg) grayscale(0)",
    );
  });

  it("blends every preset back toward neutral with strength", () => {
    expect(visualFilterCss({ id: "mono", strength: 0 })).toContain(
      "grayscale(0)",
    );
    expect(visualFilterCss({ id: "mono", strength: 1 })).toContain(
      "grayscale(1)",
    );
    expect(visualFilterCss({ id: "mono", strength: 0.5 })).toContain(
      "grayscale(0.5)",
    );
  });

  it("clamps out-of-range strengths", () => {
    expect(visualFilterCss({ id: "punch", strength: 10 })).toBe(
      visualFilterCss({ id: "punch", strength: 1 }),
    );
    expect(visualFilterCss({ id: "punch", strength: -10 })).toBe(
      visualFilterCss({ id: "punch", strength: 0 }),
    );
  });
});
