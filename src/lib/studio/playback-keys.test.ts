import { describe, expect, it } from "vitest";
import {
  FRAME_STEP,
  JUMP_STEP,
  transportSeek,
} from "@/lib/studio/playback-keys";

describe("transportSeek", () => {
  it("is null for keys that aren't transport keys", () => {
    expect(transportSeek("a", 5, 10, false)).toBeNull();
    expect(transportSeek(" ", 5, 10, false)).toBeNull();
  });

  it("steps by a frame with the arrows, a second with Shift", () => {
    expect(transportSeek("ArrowRight", 5, 10, false)).toBeCloseTo(
      5 + FRAME_STEP,
      6,
    );
    expect(transportSeek("ArrowLeft", 5, 10, false)).toBeCloseTo(
      5 - FRAME_STEP,
      6,
    );
    expect(transportSeek("ArrowRight", 5, 10, true)).toBeCloseTo(5 + JUMP_STEP);
    expect(transportSeek("ArrowLeft", 5, 10, true)).toBeCloseTo(5 - JUMP_STEP);
  });

  it("jumps to the ends with Home and End", () => {
    expect(transportSeek("Home", 5, 10, false)).toBe(0);
    expect(transportSeek("End", 5, 10, false)).toBe(10);
  });

  it("clamps into [0, duration] rather than running off either end", () => {
    // Stepping left at 0 stays at 0; stepping right at the end stays at the end.
    expect(transportSeek("ArrowLeft", 0, 10, false)).toBe(0);
    expect(transportSeek("ArrowRight", 10, 10, false)).toBe(10);
    // A coarse jump near the end clamps to the end, not past it.
    expect(transportSeek("ArrowRight", 9.5, 10, true)).toBe(10);
  });
});
