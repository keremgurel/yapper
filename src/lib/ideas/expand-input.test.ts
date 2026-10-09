import { describe, expect, it } from "vitest";
import { parseExpandIdeaInput } from "@/lib/ideas/expand-input";

describe("parseExpandIdeaInput", () => {
  it("accepts known bounded fields and drops unknown source metadata", () => {
    expect(
      parseExpandIdeaInput({
        transcript: "my angle",
        source: {
          url: "https://example.com/video",
          title: "Reference",
          referenceType: "social-video",
          collection: "ignored",
        },
      }),
    ).toEqual({
      transcript: "my angle",
      source: {
        url: "https://example.com/video",
        title: "Reference",
        referenceType: "social-video",
      },
    });
  });

  it("rejects malformed optional fields and unknown reference types", () => {
    expect(parseExpandIdeaInput({ transcript: {} })).toBeNull();
    expect(
      parseExpandIdeaInput({
        source: { url: "https://x.test", referenceType: "book" },
      }),
    ).toBeNull();
  });

  it("enforces individual and aggregate prompt budgets", () => {
    expect(parseExpandIdeaInput({ transcript: "x".repeat(8_001) })).toBeNull();
    expect(
      parseExpandIdeaInput({
        transcript: "x".repeat(8_000),
        source: {
          url: "https://x.test",
          transcript: "x".repeat(30_000),
          summary: "x".repeat(4_000),
        },
      }),
    ).toBeNull();
  });

  it("clips a long reference title instead of refusing the idea", () => {
    const caption = "NEW APP STORE CONNECT FEATURE ".repeat(20);
    const input = parseExpandIdeaInput({
      transcript: "make our own version",
      source: { url: "https://www.instagram.com/reel/x/", title: caption },
    });
    expect(input?.source?.title).toBe(caption.slice(0, 300));
  });
});
