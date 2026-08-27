import { describe, expect, it } from "vitest";
import { formatStorageBytes, storageUsagePercent } from "./format";

describe("storage formatting", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.00 KB"],
    [10 * 1024 * 1024, "10.0 MB"],
    [25 * 1024 * 1024 * 1024, "25.0 GB"],
  ])("formats %i bytes", (bytes, expected) => {
    expect(formatStorageBytes(bytes)).toBe(expected);
  });

  it("clamps percentage to a useful meter range", () => {
    expect(storageUsagePercent(25, 100)).toBe(25);
    expect(storageUsagePercent(120, 100)).toBe(100);
    expect(storageUsagePercent(-1, 100)).toBe(0);
  });
});
