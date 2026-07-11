import { describe, expect, it } from "vitest";
import { isAudioTruncated } from "@/lib/studio/transcribe-guard";

describe("isAudioTruncated", () => {
  it("flags audio the ASR heard many seconds short of what was sent", () => {
    // The real bug: 271s built, ~260s heard.
    expect(isAudioTruncated(271, 260)).toBe(true);
  });

  it("passes a full-length transcription", () => {
    expect(isAudioTruncated(271, 271)).toBe(false);
  });

  it("absorbs sub-tolerance differences (codec padding, rounding)", () => {
    // tolerance defaults to 1s
    expect(isAudioTruncated(100, 99)).toBe(false); // 99 !< 99
    expect(isAudioTruncated(100, 99.5)).toBe(false);
    expect(isAudioTruncated(100, 98)).toBe(true); // 98 < 99
  });

  it("never flags when a duration is unknown, so a missing signal can't block", () => {
    expect(isAudioTruncated(0, 260)).toBe(false);
    expect(isAudioTruncated(271, 0)).toBe(false);
    expect(isAudioTruncated(0, 0)).toBe(false);
  });

  it("honors a custom tolerance", () => {
    expect(isAudioTruncated(100, 96, 5)).toBe(false); // 96 !< 95
    expect(isAudioTruncated(100, 94, 5)).toBe(true); // 94 < 95
  });
});
