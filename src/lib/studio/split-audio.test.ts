import { describe, expect, it } from "vitest";
import { splitAudioAt } from "@/lib/studio/split-audio";
import type { AudioTrack } from "@/lib/studio/types";

function track(fields: Partial<AudioTrack> & { id: string }): AudioTrack {
  return {
    name: "music",
    url: "blob:m",
    duration: 10,
    start: 0,
    sourceStart: 0,
    mediaDuration: 30,
    muted: false,
    ...fields,
  };
}

describe("splitAudioAt", () => {
  it("cuts the clip into two continuous halves at the playhead", () => {
    // Clip plays media [4, 14) over timeline [2, 12). Cut at timeline 5.
    const a = track({ id: "a", start: 2, duration: 10, sourceStart: 4 });
    const out = splitAudioAt([a], "a", 5);
    expect(out).toHaveLength(2);
    const [left, right] = out;
    // Left keeps start + in-point, ends at the cut (local = 5 - 2 = 3).
    expect(left.start).toBe(2);
    expect(left.duration).toBe(3);
    expect(left.sourceStart).toBe(4);
    // Right starts at the cut, its in-point advanced by the same 3 seconds.
    expect(right.start).toBe(5);
    expect(right.duration).toBe(7);
    expect(right.sourceStart).toBe(7);
    // The two halves stay adjacent and cover the original span with no gap.
    expect(left.start + left.duration).toBe(right.start);
    expect(right.sourceStart).toBe(left.sourceStart + left.duration);
    // Full media length carries over to both.
    expect(left.mediaDuration).toBe(30);
    expect(right.mediaDuration).toBe(30);
  });

  it("gives the halves distinct new ids", () => {
    const a = track({ id: "a", start: 0, duration: 10 });
    const out = splitAudioAt([a], "a", 5);
    expect(out[0].id).not.toBe(out[1].id);
    expect(out[0].id).not.toBe("a");
  });

  it("is a no-op when the cut is within EPS of an edge", () => {
    const a = track({ id: "a", start: 0, duration: 10 });
    expect(splitAudioAt([a], "a", 0.01)).toHaveLength(1);
    expect(splitAudioAt([a], "a", 9.99)).toHaveLength(1);
  });

  it("leaves other clips untouched and only splits the matching id", () => {
    const a = track({ id: "a", start: 0, duration: 10 });
    const b = track({ id: "b", start: 12, duration: 10 });
    const out = splitAudioAt([a, b], "b", 17);
    expect(out.map((x) => x.id).filter((x) => x === "a")).toEqual(["a"]);
    expect(out).toHaveLength(3); // a untouched, b split in two
  });
});
