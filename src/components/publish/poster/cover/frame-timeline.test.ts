import { describe, expect, it } from "vitest";
import {
  formatFrameTime,
  nearestFrame,
  presentationTimes,
} from "./frame-timeline";

describe("frame timeline", () => {
  it("indexes presentation order even when B-frames arrive out of order", () => {
    expect(
      presentationTimes([0, 0.125, 0.041667, 0.083333, 0.125, -1, NaN]),
    ).toEqual([0, 0.041667, 0.083333, 0.125]);
  });
  it.each([24, 25, 30, 60, 30000 / 1001])(
    "keeps every actual frame at %s fps",
    (fps) => {
      const times = Array.from({ length: 200 }, (_, i) => i / fps);
      for (let i = 0; i < times.length; i++)
        expect(nearestFrame(times, times[i])).toBe(i);
      expect(nearestFrame(times, 9999)).toBe(199);
      expect(nearestFrame(times, -1)).toBe(0);
    },
  );
  it("seeks variable frame rate gaps without inventing extra frames", () => {
    const times = [0, 0.02, 0.07, 0.15, 0.16, 0.2];
    expect(nearestFrame(times, 0.06)).toBe(2);
    expect(nearestFrame(times, 0.14)).toBe(3);
    expect(nearestFrame(times, 0.18)).toBe(4);
    expect(nearestFrame([], 1)).toBe(0);
  });
  it("carries rounded milliseconds into the next second and minute", () => {
    expect(formatFrameTime(59.9999)).toBe("1:00.000");
    expect(formatFrameTime(1 / 24)).toBe("0:00.042");
  });
});
