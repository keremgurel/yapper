import { describe, expect, it } from "vitest";
import { sampleCredits, tooLong, transcriptionUnits } from "./units";

describe("transcription units", () => {
  it("bills one credit per three minutes, rounded up, at least one", () => {
    expect(transcriptionUnits(null)).toBe(1);
    expect(transcriptionUnits(0)).toBe(1);
    expect(transcriptionUnits(59)).toBe(1);
    expect(transcriptionUnits(180)).toBe(1);
    expect(transcriptionUnits(181)).toBe(2);
    expect(transcriptionUnits(600)).toBe(4);
  });

  it("caps a single video", () => {
    expect(transcriptionUnits(10_000)).toBe(8);
    expect(tooLong(1441)).toBe(true);
    expect(tooLong(1440)).toBe(false);
    expect(tooLong(null)).toBe(false);
  });

  it("reads YouTube captions for free", () => {
    expect(sampleCredits("youtube", 900)).toBe(0);
    expect(sampleCredits("instagram", null)).toBe(1);
    expect(sampleCredits("tiktok", 400)).toBe(3);
  });
});
