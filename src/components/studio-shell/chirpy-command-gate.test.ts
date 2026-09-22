import { describe, expect, it } from "vitest";
import { looksLikeCommand } from "./chirpy-command-gate";

describe("Chirpy command gate", () => {
  it("lets short one-line requests reach the command matchers", () => {
    expect(looksLikeCommand("Show my brand kit")).toBe(true);
    expect(looksLikeCommand("  change my voice to warm and direct  ")).toBe(
      true,
    );
  });
  it("sends pasted transcripts and notes to conversation instead", () => {
    expect(
      looksLikeCommand("revise my brain based on this:\n3. CONTENT PILLARS"),
    ).toBe(false);
    expect(looksLikeCommand("x".repeat(241))).toBe(false);
  });
});
