import { describe, expect, it } from "vitest";
import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("reads hours and minutes", () => {
    expect(formatDuration((72 * 60 + 3) * 60)).toBe("72 hr 3 min");
    expect(formatDuration(2 * 3600)).toBe("2 hr");
    expect(formatDuration(45 * 60)).toBe("45 min");
  });

  it("names the small cases", () => {
    expect(formatDuration(20)).toBe("Under a minute");
    expect(formatDuration(0)).toBe("0 min");
  });
});
