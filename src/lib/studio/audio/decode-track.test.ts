import { describe, expect, it } from "vitest";
import {
  estimatedDecodedPcmBytes,
  MAX_DECODED_PCM_BYTES,
  MAX_TRANSCRIPTION_MONO_PCM_BYTES,
} from "@/lib/studio/audio/decode-track";

describe("decoded PCM budgets", () => {
  it("keeps a three-minute stereo editor source within the general cap", () => {
    const bytes = estimatedDecodedPcmBytes(180, 48_000, 2);

    expect(bytes).toBe(69_120_000);
    expect(bytes).toBeGreaterThan(64 * 1024 * 1024);
    expect(bytes).toBeLessThanOrEqual(MAX_DECODED_PCM_BYTES);
  });

  it("keeps ten minutes of transcription PCM within the mono cap", () => {
    const stereoBytes = estimatedDecodedPcmBytes(600, 48_000, 2);
    const monoBytes = estimatedDecodedPcmBytes(600, 48_000, 2, true);

    expect(stereoBytes).toBe(230_400_000);
    expect(monoBytes).toBe(115_200_000);
    expect(monoBytes).toBeLessThanOrEqual(MAX_TRANSCRIPTION_MONO_PCM_BYTES);
  });

  it("fails closed for invalid metadata", () => {
    expect(estimatedDecodedPcmBytes(Number.NaN, 48_000, 2)).toBe(Infinity);
    expect(estimatedDecodedPcmBytes(1, 0, 2)).toBe(Infinity);
    expect(estimatedDecodedPcmBytes(1, 48_000, 0)).toBe(Infinity);
  });
});
