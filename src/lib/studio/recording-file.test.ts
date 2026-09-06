import { describe, expect, it } from "vitest";
import {
  recordingExtension,
  recordingFileName,
  recordingMimeType,
} from "@/lib/studio/recording-file";

describe("recordingExtension", () => {
  it("keeps webm for a WebM recording", () => {
    expect(recordingExtension("video/webm;codecs=vp8,opus")).toBe("webm");
    expect(recordingExtension("video/webm")).toBe("webm");
  });

  it("uses mp4 for an MP4 recording (Safari fallback)", () => {
    expect(recordingExtension("video/mp4")).toBe("mp4");
    expect(recordingExtension("video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe(
      "mp4",
    );
  });

  it("maps a QuickTime container to mp4", () => {
    expect(recordingExtension("video/quicktime")).toBe("mp4");
  });

  it("defaults to webm for an unknown or empty type", () => {
    expect(recordingExtension("")).toBe("webm");
    expect(recordingExtension("application/octet-stream")).toBe("webm");
  });
});

describe("recordingMimeType", () => {
  it("prefers native-compatible MP4 when the browser can record both containers", () => {
    expect(recordingMimeType(() => true)).toBe(
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    );
    expect(
      recordingMimeType(
        (type) => type === "video/mp4" || type === "video/webm",
      ),
    ).toBe("video/mp4");
  });
  it("keeps WebM capture available where MP4 is unsupported", () => {
    expect(recordingMimeType((type) => type === "video/webm")).toBe(
      "video/webm",
    );
  });
  it("lets the browser pick its default when no explicit format is supported", () => {
    expect(recordingMimeType(() => false)).toBeUndefined();
  });
});

describe("recordingFileName", () => {
  it("joins the stamp and the container extension", () => {
    expect(recordingFileName("yapper-2026-07-15T12:00:00", "video/mp4")).toBe(
      "yapper-2026-07-15T12:00:00.mp4",
    );
    expect(
      recordingFileName("yapper-take-2026-07-15T12:00:00", "video/webm"),
    ).toBe("yapper-take-2026-07-15T12:00:00.webm");
  });
});
