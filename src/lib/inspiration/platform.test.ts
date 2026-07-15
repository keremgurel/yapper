import { describe, expect, it } from "vitest";
import {
  detectKind,
  detectPlatform,
  extractHandle,
  youtubeId,
} from "./platform";

describe("detectPlatform", () => {
  it("recognizes each platform and its subdomains", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe(
      "youtube",
    );
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://m.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://www.tiktok.com/@x/video/1")).toBe("tiktok");
    expect(detectPlatform("https://www.instagram.com/reel/xyz")).toBe(
      "instagram",
    );
  });

  it("does not match look-alike domains that only share a suffix", () => {
    // The bug this guards: endsWith("youtube.com") also matched "notyoutube.com".
    expect(detectPlatform("https://notyoutube.com/watch?v=abc")).toBe(
      "unknown",
    );
    expect(detectPlatform("https://faketiktok.com/@x/video/1")).toBe("unknown");
    expect(detectPlatform("https://myinstagram.com/reel/xyz")).toBe("unknown");
  });

  it("returns unknown for junk", () => {
    expect(detectPlatform("not a url")).toBe("unknown");
    expect(detectPlatform("https://example.com/x")).toBe("unknown");
  });
});

describe("detectKind", () => {
  it("distinguishes videos from creator profiles", () => {
    expect(detectKind("https://youtube.com/watch?v=abc")).toBe("video");
    expect(detectKind("https://youtube.com/shorts/abc")).toBe("video");
    expect(detectKind("https://youtube.com/@creator")).toBe("creator");
    expect(detectKind("https://tiktok.com/@creator")).toBe("creator");
    expect(detectKind("https://tiktok.com/@creator/video/1")).toBe("video");
    expect(detectKind("https://instagram.com/creator")).toBe("creator");
    expect(detectKind("https://instagram.com/p/abc")).toBe("video");
  });

  it("does not treat a look-alike host's profile path as a creator", () => {
    // Unknown host falls through to the "video" default, not "creator".
    expect(detectKind("https://notinstagram.com/creator")).toBe("video");
  });
});

describe("youtubeId", () => {
  it("pulls the id from every YouTube URL shape", () => {
    expect(youtubeId("https://youtu.be/abc")).toBe("abc");
    expect(youtubeId("https://youtube.com/watch?v=abc")).toBe("abc");
    expect(youtubeId("https://youtube.com/shorts/abc")).toBe("abc");
    expect(youtubeId("https://youtube.com/@c")).toBeNull();
  });
});

describe("extractHandle", () => {
  it("reads the handle from profile URLs", () => {
    expect(extractHandle("https://youtube.com/@creator")).toBe("creator");
    expect(extractHandle("https://youtube.com/channel/UC123")).toBe("UC123");
    expect(extractHandle("https://tiktok.com/@creator")).toBe("creator");
    expect(extractHandle("https://instagram.com/creator")).toBe("creator");
  });

  it("returns null for look-alike hosts", () => {
    expect(extractHandle("https://notyoutube.com/@creator")).toBeNull();
  });
});
