import { describe, expect, it } from "vitest";
import { nativeMediaKind } from "@/lib/studio/native/load-native-source";

describe("nativeMediaKind", () => {
  it("recognizes common still-image formats regardless of case", () => {
    expect(nativeMediaKind("/tmp/overlay.PNG")).toBe("image");
    expect(nativeMediaKind("/tmp/photo.JpEg")).toBe("image");
    expect(nativeMediaKind("/tmp/iphone.HEIC")).toBe("image");
    expect(nativeMediaKind("C:\\media\\graphic.webp")).toBe("image");
  });

  it("keeps video and unknown media on the video path", () => {
    expect(nativeMediaKind("/tmp/take.MP4")).toBe("video");
    expect(nativeMediaKind("/tmp/recording.mov")).toBe("video");
    expect(nativeMediaKind("/tmp/no-extension")).toBe("video");
  });
});
