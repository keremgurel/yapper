import { describe, expect, it } from "vitest";
import { planChunks } from "./tiktok";

const MB = 1024 * 1024;

// Mirror uploadTikTokDraft's PUT loop to reconstruct the byte ranges a plan
// produces, so we can assert they tile the whole file.
function ranges(size: number): [number, number][] {
  const { chunkSize, count } = planChunks(size);
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    out.push([start, end]);
  }
  return out;
}

describe("planChunks", () => {
  it("uploads a whole file as one chunk up to 128MB", () => {
    expect(planChunks(5 * MB)).toEqual({ chunkSize: 5 * MB, count: 1 });
    expect(planChunks(64 * MB)).toEqual({ chunkSize: 64 * MB, count: 1 });
    // The bug this guards: a 100MB file used to announce chunk_size 64MB with
    // count 1 (64MB x 1 != 100MB), an inconsistent init TikTok can reject.
    expect(planChunks(100 * MB)).toEqual({ chunkSize: 100 * MB, count: 1 });
    expect(planChunks(128 * MB)).toEqual({ chunkSize: 128 * MB, count: 1 });
  });

  it("splits files past 128MB into 64MB chunks", () => {
    expect(planChunks(130 * MB)).toEqual({ chunkSize: 64 * MB, count: 2 });
    expect(planChunks(200 * MB)).toEqual({ chunkSize: 64 * MB, count: 3 });
  });

  it("tiles the whole file with contiguous chunks, none over 128MB", () => {
    for (const size of [5 * MB, 100 * MB, 130 * MB, 200 * MB, 260 * MB + 7]) {
      const rs = ranges(size);
      expect(rs[0][0]).toBe(0);
      expect(rs[rs.length - 1][1]).toBe(size - 1);
      for (let i = 1; i < rs.length; i++) {
        expect(rs[i][0]).toBe(rs[i - 1][1] + 1); // no gap, no overlap
      }
      for (const [s, e] of rs) {
        const len = e - s + 1;
        expect(len).toBeGreaterThan(0);
        expect(len).toBeLessThanOrEqual(128 * MB);
      }
    }
  });
});
