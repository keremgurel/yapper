import { describe, expect, it } from "vitest";
import { youtubeSnippetText } from "@/lib/publish/youtube";

describe("youtubeSnippetText", () => {
  it("strips the angle brackets YouTube's API rejects", () => {
    // "<3" and "A > B" would 400 the upload (invalidTitle) if sent as-is.
    expect(youtubeSnippetText("Follow for more <3", 100)).toBe(
      "Follow for more 3",
    );
    expect(youtubeSnippetText("Before > After", 100)).toBe("Before  After");
    expect(youtubeSnippetText("<script>", 100)).toBe("script");
  });

  it("clamps to the field length limit, after stripping", () => {
    expect(youtubeSnippetText("t".repeat(150), 100)).toHaveLength(100);
    // Brackets are removed before the count, so they don't eat into the budget.
    expect(youtubeSnippetText("<".repeat(50) + "a".repeat(100), 100)).toBe(
      "a".repeat(100),
    );
  });

  it("treats an absent value as an empty string", () => {
    expect(youtubeSnippetText(undefined, 5000)).toBe("");
  });

  it("leaves clean text untouched", () => {
    expect(youtubeSnippetText("My great video", 100)).toBe("My great video");
  });
});
