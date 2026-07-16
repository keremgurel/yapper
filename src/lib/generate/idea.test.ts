import { describe, expect, it } from "vitest";
import { parseIdea } from "@/lib/generate/idea";

describe("parseIdea", () => {
  it("pulls the idea out of surrounding prose", () => {
    const out = parseIdea(
      'Here you go: {"hooks":["h1","h2"],"points":["p1"],"example":"e","cta":"c"} done',
    );
    expect(out).toEqual({
      hooks: ["h1", "h2"],
      points: ["p1"],
      example: "e",
      cta: "c",
    });
  });

  it("drops non-string array entries and non-string scalars", () => {
    const out = parseIdea(
      JSON.stringify({
        hooks: ["ok", 5, null, "two"],
        points: [{}],
        example: 9,
      }),
    );
    expect(out.hooks).toEqual(["ok", "two"]);
    expect(out.points).toEqual([]);
    expect(out.example).toBe("");
    expect(out.cta).toBe("");
  });

  it("keeps a partial idea that has hooks but no points", () => {
    // Only BOTH being empty is a non-result; a partial idea is still usable and
    // must not throw (the creator was charged for a real generation).
    const out = parseIdea('{"hooks":["just a hook"],"points":[]}');
    expect(out.hooks).toEqual(["just a hook"]);
    expect(out.points).toEqual([]);
  });

  it("throws idea_empty when there are neither hooks nor points", () => {
    expect(() => parseIdea("{}")).toThrow("idea_empty");
    expect(() => parseIdea('{"hooks":[],"points":[],"cta":"x"}')).toThrow(
      "idea_empty",
    );
  });

  it("throws idea_unparseable when there is no JSON object", () => {
    expect(() => parseIdea("no json here")).toThrow("idea_unparseable");
  });
});
