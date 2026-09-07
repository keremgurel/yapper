import { describe, expect, it } from "vitest";
import { sampleIdFromUrl } from "./sample-id";

describe("sampleIdFromUrl", () => {
  it("finds YouTube ids in every link shape", () => {
    expect(
      sampleIdFromUrl("youtube", "https://youtube.com/watch?v=abc123"),
    ).toBe("abc123");
    expect(
      sampleIdFromUrl("youtube", "https://www.youtube.com/shorts/xyz"),
    ).toBe("xyz");
    expect(sampleIdFromUrl("youtube", "https://youtu.be/short1")).toBe(
      "short1",
    );
  });
  it("uses the last path segment elsewhere", () => {
    expect(
      sampleIdFromUrl("instagram", "https://www.instagram.com/reel/CxYz/"),
    ).toBe("CxYz");
    expect(
      sampleIdFromUrl("tiktok", "https://www.tiktok.com/@me/video/7291"),
    ).toBe("7291");
    expect(sampleIdFromUrl("tiktok", "not a url")).toBe("not a url");
  });
});
