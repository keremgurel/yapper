import { describe, expect, it } from "vitest";
import { parseCoaching } from "@/lib/feedback/coach";

describe("parseCoaching", () => {
  it("reads a well-formed coaching object out of surrounding prose", () => {
    const out = parseCoaching(
      'Sure: {"score":82,"summary":"Strong hook.","strengths":["clear"],' +
        '"improvements":["slow down"],"upgradeLines":[{"before":"um so","after":"So"}]}',
    );
    expect(out).toEqual({
      score: 82,
      summary: "Strong hook.",
      strengths: ["clear"],
      improvements: ["slow down"],
      upgradeLines: [{ before: "um so", after: "So" }],
    });
  });

  it("clamps an out-of-range score into 0-100", () => {
    expect(parseCoaching('{"score":150}').score).toBe(100);
    expect(parseCoaching('{"score":-20}').score).toBe(0);
    expect(parseCoaching('{"score":73.6}').score).toBe(74);
  });

  it("defaults a non-numeric or non-finite score to 0", () => {
    expect(parseCoaching('{"score":"high"}').score).toBe(0);
    expect(parseCoaching("{}").score).toBe(0);
  });

  it("forces a non-string summary to an empty string", () => {
    expect(parseCoaching('{"summary":42}').summary).toBe("");
    expect(parseCoaching('{"summary":{"x":1}}').summary).toBe("");
  });

  it("drops non-string entries from strengths and improvements", () => {
    const out = parseCoaching(
      '{"strengths":["a",5,null,"b"],"improvements":[{},"keep"]}',
    );
    expect(out.strengths).toEqual(["a", "b"]);
    expect(out.improvements).toEqual(["keep"]);
  });

  it("drops upgrade lines that aren't a before/after string pair", () => {
    const out = parseCoaching(
      '{"upgradeLines":[{"before":"x","after":"y"},{"before":"z"},"nope",{"before":1,"after":2}]}',
    );
    expect(out.upgradeLines).toEqual([{ before: "x", after: "y" }]);
  });

  it("throws when there is no JSON object to parse", () => {
    expect(() => parseCoaching("no json")).toThrow("coach_unparseable");
  });
});
