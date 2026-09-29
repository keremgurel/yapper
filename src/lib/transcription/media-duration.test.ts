import { expect, it } from "vitest";
import { readOwnedAudioDuration, transcriptionUnits } from "./media-duration";
it("reads duration from actual PCM audio bytes", async () => {
  const seconds = 2;
  const dataBytes = seconds * 8000 * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, index) =>
      view.setUint8(offset + index, c.charCodeAt(0)),
    );
  text(0, "RIFF");
  view.setUint32(4, dataBytes + 36, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  expect(await readOwnedAudioDuration(buffer)).toBe(2);
});
it("rounds each started three-minute block and rejects unsupported durations", () => {
  expect([1, 180, 181, 3600].map(transcriptionUnits)).toEqual([1, 1, 2, 20]);
  for (const duration of [0, -1, NaN, Infinity, 3601])
    expect(() => transcriptionUnits(duration)).toThrow();
});
