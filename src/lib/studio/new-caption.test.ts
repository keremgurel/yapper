import { describe, expect, it } from "vitest";
import { newCaptionAtTimeline } from "@/lib/studio/new-caption";
import type { Caption, Clip } from "@/lib/studio/types";

const rec = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
});

const appended = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
  src: { url: "b-roll.mp4", kind: "video", name: "b-roll.mp4", duration: 10 },
});

describe("newCaptionAtTimeline", () => {
  it("anchors at the recording second under the playhead, accounting for cuts", () => {
    // Recording [0,3] then [6,10]: edited second 4 is recording second 7.
    const clips = [rec("a", 0, 3), rec("b", 6, 10)];
    const c = newCaptionAtTimeline(clips, [], 4);
    expect(c.sourceStart).toBe(7);
    expect(c.sourceEnd).toBe(7 + 1.8);
  });

  it("anchors to the recording cut, not the b-roll clock, when over a b-roll", () => {
    // Base [0,3], then a 4s b-roll, then base [3,10]. At edited time 5 the
    // playhead is inside the b-roll; the caption must anchor at recording
    // second 3 (the cut), not at 5 or the b-roll's own 2s timestamp.
    const clips = [rec("a", 0, 3), appended("b", 0, 4), rec("c", 3, 10)];
    const c = newCaptionAtTimeline(clips, [], 5);
    expect(c.sourceStart).toBe(3);
  });

  it("stops just before the next caption instead of overlapping it", () => {
    const clips = [rec("a", 0, 10)];
    const existing: Caption[] = [
      { id: "x", text: "next", sourceStart: 2.5, sourceEnd: 4 },
    ];
    // Added at recording second 2: default end 3.8 would overlap the 2.5 caption.
    const c = newCaptionAtTimeline(clips, existing, 2);
    expect(c.sourceStart).toBe(2);
    expect(c.sourceEnd).toBeCloseTo(2.48, 5); // 2.5 - 0.02
  });

  it("keeps a minimum length even when the next caption is very close", () => {
    const clips = [rec("a", 0, 10)];
    const existing: Caption[] = [
      { id: "x", text: "next", sourceStart: 2.05, sourceEnd: 4 },
    ];
    const c = newCaptionAtTimeline(clips, existing, 2);
    expect(c.sourceEnd).toBe(2.3); // start 2 + MIN_LEN 0.3, not 2.03
  });
});
