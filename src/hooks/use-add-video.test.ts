import { describe, expect, it } from "vitest";

import { videoTypeFor } from "@/hooks/use-add-video";

describe("videoTypeFor", () => {
  it("accepts an exported MP4 even when the browser omits its MIME type", () => {
    expect(
      videoTypeFor({ name: "day 30.mp4", size: 107_430_253, type: "" }),
    ).toBe("video/mp4");
  });

  it("keeps a browser-provided video type", () => {
    expect(
      videoTypeFor({ name: "take.bin", size: 100, type: "video/quicktime" }),
    ).toBe("video/quicktime");
  });

  it("rejects empty and non-video files", () => {
    expect(
      videoTypeFor({ name: "empty.mp4", size: 0, type: "video/mp4" }),
    ).toBeNull();
    expect(
      videoTypeFor({ name: "notes.txt", size: 100, type: "text/plain" }),
    ).toBeNull();
  });
});
