import { describe, expect, it } from "vitest";
import { scriptMeter } from "@/lib/content/script-meter";

describe("scriptMeter", () => {
  it("is zero for nothing written yet", () => {
    expect(scriptMeter(null)).toEqual({ words: 0, seconds: 0, label: "0s" });
    expect(scriptMeter("   ")).toMatchObject({ words: 0, seconds: 0 });
  });

  it("counts words across newlines and runs of spaces", () => {
    expect(scriptMeter("one two\n\nthree    four").words).toBe(4);
  });

  it("reports seconds under a minute", () => {
    // 145 wpm, so 72 words is roughly half a minute.
    expect(scriptMeter(new Array(72).fill("word").join(" ")).label).toBe("30s");
  });

  it("switches to m:ss once it passes a minute", () => {
    const meter = scriptMeter(new Array(290).fill("word").join(" "));
    expect(meter.seconds).toBe(120);
    expect(meter.label).toBe("2:00");
  });

  it("pads the seconds so 1:05 never reads as 1:5", () => {
    expect(scriptMeter(new Array(157).fill("word").join(" ")).label).toBe(
      "1:05",
    );
  });
});
