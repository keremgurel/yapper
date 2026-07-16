import { describe, expect, it } from "vitest";
import { planSpanOverlays } from "@/lib/studio/place-spans";
import type { PlacedSpan } from "@/lib/studio/overlay-plan";
import type { Clip, MediaAsset } from "@/lib/studio/types";

// One full clip that reads the recording, so sourceToTimeline is the identity
// over [0, 100] and the timeline math is easy to reason about.
const clips: Clip[] = [{ id: "c", start: 0, end: 100 }];

const assets: MediaAsset[] = [
  {
    id: "v",
    kind: "video",
    url: "vurl",
    name: "v.mp4",
    duration: 5,
    width: 1920,
    height: 1080,
  },
  {
    id: "long",
    kind: "video",
    url: "lurl",
    name: "long.mp4",
    duration: 100,
    width: 1080,
    height: 1920,
  },
  {
    id: "img",
    kind: "image",
    url: "iurl",
    name: "i.png",
    duration: 5,
    width: 1000,
    height: 1000,
  },
];

const span = (file: string, s: number, e: number): PlacedSpan => ({
  file,
  sourceStart: s,
  sourceEnd: e,
});

const plan = (spans: PlacedSpan[]) =>
  planSpanOverlays(spans, [], clips, assets, 9 / 16);

describe("planSpanOverlays", () => {
  it("maps a span to a timeline overlay from its library asset", () => {
    const out = plan([span("v.mp4", 2, 5)]);
    expect(out).toHaveLength(1);
    expect(out[0].overlay).toMatchObject({
      kind: "video",
      url: "vurl",
      name: "v.mp4",
      track: 0,
      start: 2,
      duration: 3,
      sourceStart: 0,
      muted: true,
    });
    expect(out[0].span).toEqual(span("v.mp4", 2, 5));
  });

  it("drops a span whose file is not in the library", () => {
    expect(plan([span("missing.mp4", 2, 5)])).toEqual([]);
  });

  it("drops a span shorter than the minimum once mapped to the timeline", () => {
    expect(plan([span("v.mp4", 2, 2.2)])).toEqual([]); // 0.2s < MIN_SPAN_SEC
  });

  it("clamps a video to its media length but lets an image run the whole span", () => {
    // Span is 18s long; the video asset is only 5s, the image has no such limit.
    expect(plan([span("v.mp4", 2, 20)])[0].overlay.duration).toBe(5);
    expect(plan([span("i.png", 2, 20)])[0].overlay.duration).toBe(18);
  });

  it("packs overlapping cutaways onto separate tracks", () => {
    const out = plan([span("long.mp4", 2, 8), span("long.mp4", 4, 10)]);
    expect(out.map((p) => p.overlay.track)).toEqual([0, 1]);
  });
});
