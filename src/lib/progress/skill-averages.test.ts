import { describe, expect, it } from "vitest";
import { skillWindowAverages } from "./skill-averages";

const session = (value: number, expressive: number | null = value) => ({
  clear: value,
  fluent: value,
  expressive,
  structured: value,
});

describe("skill averages for the dashboard", () => {
  it("averages each skill over the latest window", () => {
    const result = skillWindowAverages([session(60), session(80)]);
    expect(result.clear).toEqual({ average: 70, delta: null });
    expect(result.expressive).toEqual({ average: 70, delta: null });
  });

  it("skips sessions that did not measure a skill", () => {
    const result = skillWindowAverages([
      session(50, null),
      session(70, 90),
      session(90, null),
    ]);
    expect(result.clear.average).toBe(70);
    expect(result.expressive.average).toBe(90);
  });

  it("reports nothing for a skill no session measured", () => {
    const result = skillWindowAverages([session(50, null)]);
    expect(result.expressive).toEqual({ average: null, delta: null });
    expect(skillWindowAverages([]).clear).toEqual({
      average: null,
      delta: null,
    });
  });

  it("compares the latest window with the sessions before it", () => {
    const earlier = Array.from({ length: 5 }, () => session(50));
    const latest = Array.from({ length: 5 }, () => session(70));
    expect(skillWindowAverages([...earlier, ...latest]).fluent).toEqual({
      average: 70,
      delta: 20,
    });
  });
});
