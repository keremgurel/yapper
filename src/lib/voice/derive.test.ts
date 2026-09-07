import { describe, expect, it } from "vitest";
import { parseDerivedVoice } from "./derive";
import { describeSamples } from "./derive-prompt";

describe("derived voice", () => {
  it("keeps the four fields, cleaned of dashes", () => {
    const parsed = parseDerivedVoice(
      JSON.stringify({
        voice: "Fast and dry — second person.",
        scriptingPatterns: "Opens on the mistake.",
        whatIMake: "",
        audience: 12,
      }),
    );
    expect(parsed.voice).toBe("Fast and dry, second person.");
    expect(parsed.scriptingPatterns).toBe("Opens on the mistake.");
    expect(parsed.audience).toBe("");
  });

  it("rejects an answer with nothing usable", () => {
    expect(() => parseDerivedVoice("{}")).toThrow("voice_empty");
    expect(() => parseDerivedVoice("nope")).toThrow("voice_unparseable");
  });

  it("labels each transcript and caps its length", () => {
    const text = describeSamples([
      { title: "", transcript: "a".repeat(5000) },
      { title: "Second", transcript: "hello" },
    ]);
    expect(text.startsWith("VIDEO 1: Video 1\n")).toBe(true);
    expect(text).toContain("VIDEO 2: Second\nhello");
    expect(text.length).toBeLessThan(4200);
  });
});
