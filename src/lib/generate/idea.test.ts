import { describe, expect, it } from "vitest";
import { parseIdea } from "@/lib/generate/idea";

const section = (over: Record<string, unknown> = {}) => ({
  label: "Key points",
  kind: "bullets",
  items: ["p1"],
  ...over,
});

describe("parseIdea", () => {
  it("pulls the idea out of surrounding prose", () => {
    const out = parseIdea(
      `Here you go: {"hooks":["h1","h2"],"sections":[${JSON.stringify(
        section(),
      )}]} done`,
    );
    expect(out).toEqual({
      hooks: ["h1", "h2"],
      sections: [{ label: "Key points", kind: "bullets", items: ["p1"] }],
    });
  });

  it("drops non-string hooks and malformed sections", () => {
    const out = parseIdea(
      JSON.stringify({
        hooks: ["ok", 5, null, "two"],
        // No kind, and a label with no body: neither is renderable.
        sections: [{ label: "Nope" }, section({ items: [], text: "" })],
      }),
    );
    expect(out.hooks).toEqual(["ok", "two"]);
    expect(out.sections).toEqual([]);
  });

  it("keeps a partial idea that has hooks but no sections", () => {
    // Only BOTH being empty is a non-result; a partial idea is still usable and
    // must not throw (the creator was charged for a real generation).
    const out = parseIdea('{"hooks":["just a hook"],"sections":[]}');
    expect(out.hooks).toEqual(["just a hook"]);
    expect(out.sections).toEqual([]);
  });

  /** The idea generator no longer emits fixed points/example/cta. A model that
   * answers in the old shape has produced nothing this app can store, so it
   * must read as empty rather than being silently accepted and charged for. */
  it("treats the retired fixed-template shape as empty", () => {
    expect(() =>
      parseIdea('{"points":["p1"],"example":"e","cta":"c"}'),
    ).toThrow("idea_empty");
  });

  it("throws idea_empty when there are neither hooks nor sections", () => {
    expect(() => parseIdea("{}")).toThrow("idea_empty");
    expect(() => parseIdea('{"hooks":[],"sections":[]}')).toThrow("idea_empty");
  });

  it("throws idea_unparseable when there is no JSON object", () => {
    expect(() => parseIdea("no json here")).toThrow("idea_unparseable");
  });
});
