import { describe, expect, it } from "vitest";
import { buildTicks } from "@/lib/studio/ruler";

describe("buildTicks", () => {
  it("returns no ticks for an empty timeline", () => {
    expect(buildTicks(0, 80)).toEqual([]);
    expect(buildTicks(-5, 80)).toEqual([]);
  });

  it("spaces ticks so labels stay ~90px apart", () => {
    // raw = 90/80 = 1.125, so the 2s step is chosen.
    const ticks = buildTicks(6, 80);
    expect(ticks.map((t) => t.sec)).toEqual([0, 2, 4, 6]);
    expect(ticks.map((t) => t.x)).toEqual([0, 160, 320, 480]);
    expect(ticks.map((t) => t.label)).toEqual(["0:00", "0:02", "0:04", "0:06"]);
  });

  it("rolls a sub-second tick up to the next minute instead of showing :60", () => {
    // pxPerSec = 800 -> raw = 0.1125 -> the 0.5s step, so 59.5 is a real tick.
    const ticks = buildTicks(60, 800);
    expect(ticks.some((t) => t.label.endsWith(":60"))).toBe(false);
    const at595 = ticks.find((t) => t.sec === 59.5);
    expect(at595?.label).toBe("1:00");
  });

  it("labels whole-minute boundaries correctly", () => {
    // raw = 90/45 = 2, so the 2s step; a tick lands exactly on 60s.
    const ticks = buildTicks(120, 45);
    expect(ticks.find((t) => t.sec === 60)?.label).toBe("1:00");
    expect(ticks.find((t) => t.sec === 118)?.label).toBe("1:58");
  });
});
