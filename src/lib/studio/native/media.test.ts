import { describe, expect, it } from "vitest";
import { deinterleavePcmChunk } from "@/lib/studio/native/media";

describe("deinterleavePcmChunk", () => {
  it("appends stereo frames at the requested output offset", () => {
    const output = [new Float32Array(4), new Float32Array(4)];
    const next = deinterleavePcmChunk(
      new Float32Array([0.1, -0.1, 0.2, -0.2]),
      2,
      output,
      1,
    );

    expect(next).toBe(3);
    expect(output[0][1]).toBeCloseTo(0.1);
    expect(output[0][2]).toBeCloseTo(0.2);
    expect(output[1][1]).toBeCloseTo(-0.1);
    expect(output[1][2]).toBeCloseTo(-0.2);
  });

  it("rejects a partial interleaved frame", () => {
    expect(() =>
      deinterleavePcmChunk(
        new Float32Array([1, 2, 3]),
        2,
        [new Float32Array(2), new Float32Array(2)],
        0,
      ),
    ).toThrow("invalid interleaved PCM chunk");
  });
});
