import { describe, expect, it } from "vitest";
import { inspectionText, parseTimelineInspection } from "./timeline-inspection";
import { parseDirectInput } from "./direct-input";

const evidence = {
  frames: [{ at: 3, jpeg: "/9j/AA==" }],
  words: [{ text: "Now", at: 3, end: 3.4 }],
  waveform: [{ at: 3, db: -12 }],
};
describe("bounded edited-timeline evidence", () => {
  it("keeps time coordinates and attaches no image bytes to prompt text", () => {
    expect(parseTimelineInspection(evidence)).toEqual(evidence);
    expect(inspectionText(evidence)).toContain('"frameTimes":[3]');
    expect(inspectionText(evidence)).not.toContain("/9j/");
    expect(
      parseDirectInput({ words: [{ text: "Now" }], inspection: evidence })
        ?.inspection,
    ).toEqual(evidence);
  });
  it.each([
    { ...evidence, frames: [] },
    { ...evidence, frames: Array(9).fill(evidence.frames[0]) },
    {
      ...evidence,
      frames: [{ at: 1, jpeg: "https://attacker.example/image.jpg" }],
    },
    { ...evidence, frames: [{ at: NaN, jpeg: "/9j/AA==" }] },
    { ...evidence, frames: [{ at: 0, jpeg: "/9j/" + "A".repeat(300_000) }] },
    { ...evidence, words: [{ text: "Now", at: 3, end: 2 }] },
    { ...evidence, waveform: [{ at: 1, db: Infinity }] },
  ])("rejects malformed or oversized evidence", (input) => {
    expect(parseTimelineInspection(input)).toBeNull();
    expect(parseDirectInput({ words: [], inspection: input })).toBeNull();
  });
});
