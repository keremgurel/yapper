import { describe, expect, it } from "vitest";
import {
  formatClock,
  sceneNumberText,
} from "@/lib/studio/scene/scene-number-text";
import { validateScene } from "@/lib/studio/scene/scene-validate";

describe("clock number format", () => {
  it("reads seconds as m:ss, the way the app draws it", () => {
    expect(formatClock(300)).toBe("5:00");
    expect(formatClock(299.4)).toBe("4:59");
    expect(formatClock(59.5)).toBe("1:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(4500)).toBe("75:00");
    expect(formatClock(-0.3)).toBe("0:00");
    expect(formatClock(-61)).toBe("-1:01");
  });

  it("keeps a countdown as one number node", () => {
    const result = validateScene({
      version: 1,
      duration: 6,
      nodes: [
        {
          id: "timer",
          type: "number",
          from: 300,
          to: 0,
          format: "clock",
          size: 0.4,
          x: 0.1,
          y: 0.2,
          width: 0.8,
          height: 0.5,
        },
      ],
      animations: [
        {
          node: "timer",
          property: "value",
          from: 0,
          to: 1,
          start: 0,
          end: 6,
          easing: "linear",
        },
      ],
    });
    const timer = result?.scene.nodes[0];
    expect(timer).toMatchObject({ type: "number", format: "clock" });
    expect(result?.notes).toEqual([]);
  });

  it("measures the clock text for the layout preflight", () => {
    expect(
      sceneNumberText({ format: "clock", prefix: "", suffix: " left" }, 300),
    ).toBe("5:00 left");
    expect(
      sceneNumberText({ format: "grouped", prefix: "$", suffix: "" }, 2850),
    ).toBe("$2,850");
  });
});
