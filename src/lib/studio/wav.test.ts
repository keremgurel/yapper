import { describe, expect, it } from "vitest";
import { encodeWav } from "@/lib/studio/wav";

async function view(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function tag(v: DataView, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++)
    s += String.fromCharCode(v.getUint8(offset + i));
  return s;
}

describe("encodeWav", () => {
  it("writes a correct 16-bit mono PCM header", async () => {
    const v = await view(encodeWav(new Float32Array(4), 16000));
    expect(tag(v, 0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + 4 * 2); // RIFF size = 36 + data bytes
    expect(tag(v, 8, 4)).toBe("WAVE");
    expect(tag(v, 12, 4)).toBe("fmt ");
    expect(v.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(v.getUint16(20, true)).toBe(1); // format = PCM
    expect(v.getUint16(22, true)).toBe(1); // channels = mono
    expect(v.getUint32(24, true)).toBe(16000); // sample rate
    expect(v.getUint32(28, true)).toBe(16000 * 2); // byte rate = rate * blockAlign
    expect(v.getUint16(32, true)).toBe(2); // block align = channels * bytesPerSample
    expect(v.getUint16(34, true)).toBe(16); // bits per sample
    expect(tag(v, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(4 * 2); // data size in bytes
  });

  it("sizes the buffer at 44 header bytes plus two per sample", async () => {
    const blob = encodeWav(new Float32Array(100), 16000);
    expect(blob.size).toBe(44 + 100 * 2);
  });

  it("scales samples across the full signed 16-bit range", async () => {
    const v = await view(encodeWav(Float32Array.from([-1, 0, 1, 0.5]), 16000));
    expect(v.getInt16(44 + 0 * 2, true)).toBe(-32768); // -1 uses INT16_MIN
    expect(v.getInt16(44 + 1 * 2, true)).toBe(0);
    expect(v.getInt16(44 + 2 * 2, true)).toBe(32767); // +1 uses INT16_MAX
    expect(v.getInt16(44 + 3 * 2, true)).toBe(16383); // 0.5 * 32767, truncated
  });

  it("clamps out-of-range samples before scaling", async () => {
    const v = await view(encodeWav(Float32Array.from([2, -2]), 16000));
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
});
