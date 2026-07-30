import { describe, expect, it } from "vitest";
import { chunkMono16k, planPcmChunks } from "@/lib/studio/audio/asr-audio";
import { mergeTranscribedChunks } from "@/lib/studio/transcribe-remote";

describe("transcription chunk transport", () => {
  it("keeps every fallback upload under the byte limit with overlap", () => {
    const chunks = chunkMono16k(new Float32Array(16000 * 12), 100_000, 1);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.blob.size <= 100_000)).toBe(true);
    expect(chunks[1].offsetSec).toBeLessThan(
      chunks[0].offsetSec + chunks[0].durationSec,
    );
  });

  it("covers a 15-minute recording with bounded, gapless upload windows", () => {
    const sampleRate = 16_000;
    const maxBytes = 1_000_000;
    const overlapSamples = 5 * sampleRate;
    const totalSamples = 15 * 60 * sampleRate;
    const ranges = planPcmChunks(totalSamples, sampleRate, maxBytes, 5);

    expect(ranges).toHaveLength(35);
    expect(ranges[0]).toEqual({ start: 0, end: 499_978 });
    expect(ranges.at(-1)?.end).toBe(totalSamples);
    for (let index = 0; index < ranges.length; index++) {
      const range = ranges[index];
      expect(44 + (range.end - range.start) * 2).toBeLessThanOrEqual(maxBytes);
      if (index > 0) {
        expect(ranges[index - 1].end - range.start).toBe(overlapSamples);
      }
    }
  });

  it("rejects unsafe chunk plans instead of looping or leaving gaps", () => {
    expect(() => planPcmChunks(100, 16_000, 44, 5)).toThrow(
      "invalid PCM chunk parameters",
    );
    expect(() => planPcmChunks(-1, 16_000, 1_000_000, 5)).toThrow(
      "invalid PCM chunk parameters",
    );
  });

  it("deduplicates overlapping words at the overlap midpoint", () => {
    const empty = new Blob();
    const merged = mergeTranscribedChunks([
      {
        blob: empty,
        via: "aac",
        offsetSec: 0,
        durationSec: 10,
        words: [
          { text: "before", start: 7, end: 8 },
          { text: "duplicate", start: 8.5, end: 9.5 },
        ],
      },
      {
        blob: empty,
        via: "aac",
        offsetSec: 8,
        durationSec: 10,
        words: [
          { text: "duplicate", start: 0.5, end: 1.5 },
          { text: "after", start: 2, end: 3 },
        ],
      },
    ]);

    expect(merged.map((word) => word.text)).toEqual([
      "before",
      "duplicate",
      "after",
    ]);
    expect(merged[1].start).toBe(8.5);
    expect(merged[2].start).toBe(10);
  });

  it("deduplicates a seam word even when timestamp drift puts both copies on owned sides", () => {
    const empty = new Blob();
    const merged = mergeTranscribedChunks([
      {
        blob: empty,
        via: "aac",
        offsetSec: 0,
        durationSec: 10,
        words: [
          { text: "intro", start: 7, end: 8 },
          { text: "seam", start: 8.5, end: 9.1 },
          { text: "after", start: 9.2, end: 9.8 },
        ],
      },
      {
        blob: empty,
        via: "aac",
        offsetSec: 8,
        durationSec: 10,
        words: [
          { text: "seam", start: 0.9, end: 1.5 },
          { text: "after", start: 1.7, end: 2.3 },
        ],
      },
    ]);

    expect(merged.map((word) => word.text)).toEqual(["intro", "seam", "after"]);
  });

  it("keeps a seam word even when timestamp drift puts both copies on discarded sides", () => {
    const empty = new Blob();
    const merged = mergeTranscribedChunks([
      {
        blob: empty,
        via: "aac",
        offsetSec: 0,
        durationSec: 10,
        words: [
          { text: "intro", start: 7, end: 8 },
          { text: "seam", start: 8.9, end: 9.5 },
          { text: "after", start: 9.4, end: 10 },
        ],
      },
      {
        blob: empty,
        via: "aac",
        offsetSec: 8,
        durationSec: 10,
        words: [
          { text: "seam", start: 0.5, end: 1.1 },
          { text: "after", start: 1.3, end: 1.9 },
        ],
      },
    ]);

    expect(merged.map((word) => word.text)).toEqual(["intro", "seam", "after"]);
  });
});
