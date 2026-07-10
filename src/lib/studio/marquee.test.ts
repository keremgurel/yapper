import { describe, expect, it } from "vitest";
import { spansOverlap } from "@/lib/studio/marquee";

describe("spansOverlap", () => {
  it("catches a span the box covers entirely", () => {
    expect(spansOverlap(2, 3, 0, 10)).toBe(true);
  });

  it("catches a span the box only clips the end of", () => {
    expect(spansOverlap(0, 5, 4, 10)).toBe(true);
  });

  it("catches a span the box only clips the start of", () => {
    expect(spansOverlap(5, 10, 0, 6)).toBe(true);
  });

  it("catches a span that swallows the box", () => {
    expect(spansOverlap(0, 10, 4, 5)).toBe(true);
  });

  it("misses a span entirely to the left of the box", () => {
    expect(spansOverlap(0, 1, 2, 3)).toBe(false);
  });

  it("misses a span entirely to the right of the box", () => {
    expect(spansOverlap(5, 6, 2, 3)).toBe(false);
  });

  it("catches a span the box just touches", () => {
    // Drag a box up against a clip's edge and you mean to catch it.
    expect(spansOverlap(2, 4, 4, 8)).toBe(true);
    expect(spansOverlap(4, 8, 0, 4)).toBe(true);
  });

  it("catches a zero-width box sitting on a span", () => {
    expect(spansOverlap(0, 10, 5, 5)).toBe(true);
  });
});
