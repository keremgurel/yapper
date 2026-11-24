import { describe, expect, it } from "vitest";
import { fitTitleSize } from "./fit-title";

describe("fitTitleSize", () => {
  it("keeps a 16-character title at the measured 108 px", () => {
    expect(fitTitleSize("Sixteen letters.", 926, 108)).toBe(108);
  });

  it("shrinks a longer title to stay on one line", () => {
    const size = fitTitleSize("A much longer series title", 926, 108);
    expect(size).toBeLessThan(108);
    expect(size).toBeGreaterThan(56);
  });

  it("never goes below the floor", () => {
    expect(fitTitleSize("x".repeat(80), 926, 108)).toBe(56);
  });
});
