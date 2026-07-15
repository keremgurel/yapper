import { describe, expect, it } from "vitest";
import { parseCapturedIdea } from "@/lib/content/capture";

describe("parseCapturedIdea", () => {
  it("snaps a paraphrased pillar back to the creator's existing one, verbatim", () => {
    const out = parseCapturedIdea('{"title":"T","pillar":"fitness tips"}', [
      "Fitness Tips",
      "Mindset",
    ]);
    expect(out.pillar).toBe("Fitness Tips");
  });

  it("keeps a genuinely new pillar when none of the existing ones match", () => {
    const out = parseCapturedIdea('{"title":"T","pillar":"Cooking"}', [
      "Fitness Tips",
    ]);
    expect(out.pillar).toBe("Cooking");
  });

  it("drops a blank pillar to undefined so the library gets no empty tag", () => {
    const out = parseCapturedIdea('{"title":"T","pillar":"   "}', [
      "Fitness Tips",
    ]);
    expect(out.pillar).toBeUndefined();
  });

  it("requires a title", () => {
    expect(() => parseCapturedIdea('{"pillar":"X"}', [])).toThrow(
      "capture_empty",
    );
    expect(() => parseCapturedIdea('{"title":"   "}', [])).toThrow(
      "capture_empty",
    );
  });

  it("throws when there is no object to parse", () => {
    expect(() => parseCapturedIdea("nope", [])).toThrow("capture_unparseable");
  });

  it("clamps text fields and drops non-string array entries", () => {
    const out = parseCapturedIdea(
      JSON.stringify({
        title: "t".repeat(200),
        angle: "a".repeat(400),
        hooks: ["one", 2, "three", null, "four", "five", "six"],
        points: ["p", {}, "q"],
      }),
      [],
    );
    expect(out.title).toHaveLength(120);
    expect(out.angle).toHaveLength(300);
    expect(out.hooks).toEqual(["one", "three", "four", "five", "six"]); // non-strings dropped, capped at 5
    expect(out.points).toEqual(["p", "q"]);
  });
});
