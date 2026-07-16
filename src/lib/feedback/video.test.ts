import { describe, expect, it } from "vitest";
import { parseVideoCoaching } from "@/lib/feedback/video";

describe("parseVideoCoaching", () => {
  it("clamps the score and sanitizes list fields like the audio parser", () => {
    const out = parseVideoCoaching(
      '{"score":150,"summary":"Good eye contact.","strengths":["framing",7],' +
        '"improvements":[],"upgradeLines":[{"before":"a","after":"b"},"bad"]}',
    );
    expect(out.score).toBe(100); // was stored unclamped before the shared sanitizer
    expect(out.summary).toBe("Good eye contact.");
    expect(out.strengths).toEqual(["framing"]);
    expect(out.upgradeLines).toEqual([{ before: "a", after: "b" }]);
  });

  it("forces a non-string summary to empty", () => {
    // With a strength present it won't trip the empty guard, so we can observe
    // the summary coercion itself.
    const out = parseVideoCoaching('{"summary":42,"strengths":["x"]}');
    expect(out.summary).toBe("");
  });

  it("throws video_empty when there's no summary and no strengths", () => {
    expect(() => parseVideoCoaching('{"improvements":["x"]}')).toThrow(
      "video_empty",
    );
  });

  it("throws video_unparseable when there's no JSON object", () => {
    expect(() => parseVideoCoaching("no json")).toThrow("video_unparseable");
  });
});
