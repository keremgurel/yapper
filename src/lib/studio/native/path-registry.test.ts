import { describe, expect, it } from "vitest";
import {
  nativePathForUrl,
  registerNativePath,
} from "@/lib/studio/native/path-registry";

describe("nativePathForUrl", () => {
  it("prefers a registered source path", () => {
    registerNativePath(
      "asset://localhost/opaque",
      "/Users/test/source.mov",
      16 / 9,
      10,
    );
    expect(nativePathForUrl("asset://localhost/opaque")).toBe(
      "/Users/test/source.mov",
    );
  });

  it("recovers a macOS path from a restored Tauri asset URL", () => {
    const path = "/Users/test/Downloads/0729 (1).mp4";
    expect(
      nativePathForUrl(`asset://localhost/${encodeURIComponent(path)}`),
    ).toBe(path);
  });

  it("rejects ordinary web and relative URLs", () => {
    expect(nativePathForUrl("https://example.com/video.mp4")).toBeUndefined();
    expect(nativePathForUrl("asset://localhost/relative.mp4")).toBeUndefined();
  });
});
