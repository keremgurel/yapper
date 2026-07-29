import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/ideas/parse-capture";
import { deriveIdeaType } from "@/lib/ideas/derive-type";

describe("parseCapture", () => {
  it("bare words become an original idea", () => {
    const input = parseCapture("a video about why filler words kill authority");
    expect(input.url).toBeUndefined();
    expect(input.transcript).toContain("filler words");
    expect(deriveIdeaType(input)).toBe("original");
  });

  it("a bare link becomes an inspiration", () => {
    const input = parseCapture("https://www.tiktok.com/@x/video/123");
    expect(input.url).toBe("https://www.tiktok.com/@x/video/123");
    expect(input.transcript).toBeUndefined();
    expect(deriveIdeaType(input)).toBe("inspiration");
  });

  it("a link plus words becomes a semi-original", () => {
    const input = parseCapture(
      "do this but for CELPIP https://instagram.com/reel/abc",
    );
    expect(input.url).toBe("https://instagram.com/reel/abc");
    expect(input.transcript).toBe("do this but for CELPIP");
    expect(deriveIdeaType(input)).toBe("semi-original");
  });
});
