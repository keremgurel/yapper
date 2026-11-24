import { describe, expect, it } from "vitest";
import { resolveOptions } from "../../format/resolve-values";
import { splitOptions } from "./options";
import { splitGeometry } from "./split-geometry";

describe("splitGeometry", () => {
  it("reproduces the measured Ep. 15 layout from the defaults", () => {
    const geometry = splitGeometry(resolveOptions(splitOptions).values);
    // look.ts: speaker { scale 0.82, top 1000, sourceTop 280 }, visual { 40, 210, 1000, 770 }.
    expect(geometry.visual).toEqual({
      left: 40,
      top: 210,
      width: 1000,
      height: 770,
    });
    expect(geometry.speaker.top).toBe(1000);
    expect(geometry.speaker.height).toBe(920);
    expect(geometry.speaker.width).toBeCloseTo(885.6);
    expect(geometry.speaker.left).toBeCloseTo(97.2);
    expect(geometry.take.top).toBeCloseTo(-229.6);
    expect(geometry.take.height).toBeCloseTo(1574.4);
  });

  it("keeps the visual box above the speaker when the speaker moves", () => {
    const { visual } = splitGeometry(
      resolveOptions(splitOptions, { speakerTop: 1200, seamGap: 40 }).values,
    );
    expect(visual.top + visual.height).toBe(1160);
  });
});
