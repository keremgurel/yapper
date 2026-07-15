import { describe, expect, it } from "vitest";
import { formatCount } from "./format";

describe("formatCount", () => {
  it("returns 0 for empty, negative, or non-finite input", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(-5)).toBe("0");
    expect(formatCount(NaN)).toBe("0");
  });

  it("leaves counts under 1000 as-is", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(42)).toBe("42");
  });

  it("formats thousands and millions with one decimal", () => {
    expect(formatCount(1000)).toBe("1K");
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(12900)).toBe("12.9K");
    expect(formatCount(1_400_000)).toBe("1.4M");
    expect(formatCount(12_000_000)).toBe("12M");
  });

  it("rolls over at unit boundaries instead of showing 1000K", () => {
    // The bug this guards: 999999 used to render as "1000K".
    expect(formatCount(999_999)).toBe("1M");
    expect(formatCount(999_499)).toBe("999K");
    expect(formatCount(999_999_999)).toBe("1B");
  });

  it("scales up to billions", () => {
    expect(formatCount(1_000_000_000)).toBe("1B");
    expect(formatCount(1_200_000_000)).toBe("1.2B");
  });
});
