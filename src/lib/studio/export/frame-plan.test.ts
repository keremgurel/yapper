import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTION_STYLE } from "@/lib/studio/captions";
import { baseAt, captionAt, overlaysAt } from "@/lib/studio/export/frame-plan";
import type { Caption, Clip, Overlay, StudioSource } from "@/lib/studio/types";

const source: StudioSource = {
  url: "recording.webm",
  name: "recording",
  duration: 10,
};

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

const overlay = (patch: Partial<Overlay> = {}): Overlay => ({
  id: "o",
  kind: "video",
  url: "o.mp4",
  name: "o.mp4",
  track: 0,
  start: 2,
  duration: 3,
  sourceStart: 1,
  ...patch,
});

const caption = (
  sourceStart: number,
  sourceEnd: number,
  text: string,
  extra: Partial<Caption> = {},
): Caption => ({
  id: `c-${sourceStart}`,
  text,
  sourceStart,
  sourceEnd,
  ...extra,
});

describe("baseAt", () => {
  it("reads the recording where a recording clip plays", () => {
    expect(baseAt([rec("a", 2, 6)], source, 1)).toEqual({
      url: "recording.webm",
      kind: "video",
      sourceTime: 3,
    });
  });

  it("reads an appended clip's own media in its own timebase", () => {
    // tl 0..3 = recording 0..3, tl 3..7 = b-roll's own seconds 0..4.
    const clips = [rec("a", 0, 3), appended("b", 0, 4)];
    expect(baseAt(clips, source, 5)).toEqual({
      url: "b-roll.mp4",
      kind: "video",
      sourceTime: 2,
    });
  });

  it("follows a reordered clip", () => {
    // The recording's second half was dragged in front of its first half.
    const clips = [rec("b", 5, 10), rec("a", 0, 5)];
    expect(baseAt(clips, source, 1)?.sourceTime).toBe(6);
    expect(baseAt(clips, source, 6)?.sourceTime).toBe(1);
  });

  it("returns null past the end of the bottom track", () => {
    // The layers above outlast it; the last frame must not freeze on screen.
    expect(baseAt([rec("a", 0, 3)], source, 3)).toBeNull();
    expect(baseAt([rec("a", 0, 3)], source, 4)).toBeNull();
  });

  it("returns null for an empty bottom track", () => {
    expect(baseAt([], source, 0)).toBeNull();
  });

  it("returns null when the recording is gone and the clip has no media", () => {
    expect(baseAt([rec("a", 0, 3)], null, 1)).toBeNull();
  });

  it("still plays appended clips after the recording is deleted", () => {
    expect(baseAt([appended("b", 0, 4)], null, 1)).toEqual({
      url: "b-roll.mp4",
      kind: "video",
      sourceTime: 1,
    });
  });
});

describe("overlaysAt", () => {
  it("maps timeline time into the overlay's own media", () => {
    const [frame] = overlaysAt([overlay()], 3);
    expect(frame.sourceTime).toBe(2); // 1s in, from an in-point of 1.
  });

  it("is half-open: active at its start, gone at its end", () => {
    expect(overlaysAt([overlay()], 2)).toHaveLength(1);
    expect(overlaysAt([overlay()], 4.999)).toHaveLength(1);
    expect(overlaysAt([overlay()], 5)).toHaveLength(0);
    expect(overlaysAt([overlay()], 1.999)).toHaveLength(0);
  });

  it("skips hidden overlays", () => {
    expect(overlaysAt([overlay({ hidden: true })], 3)).toEqual([]);
  });

  it("paints the higher track last, whatever order the array is in", () => {
    const frames = overlaysAt(
      [overlay({ id: "top", track: 1 }), overlay({ id: "bottom", track: 0 })],
      3,
    );
    expect(frames.map((f) => f.id)).toEqual(["bottom", "top"]);
  });

  it("returns full-frame boxes by default", () => {
    expect(overlaysAt([overlay()], 3)[0]).toMatchObject({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("paints later overlays on top", () => {
    const under = overlay({ id: "under" });
    const over = overlay({ id: "over" });
    expect(overlaysAt([under, over], 3).map((f) => f.id)).toEqual([
      "under",
      "over",
    ]);
  });

  it("does not care what the bottom track is doing", () => {
    // An overlay past the end of the base track still composites.
    expect(overlaysAt([overlay({ start: 100 })], 101)).toHaveLength(1);
  });
});

describe("captionAt", () => {
  const style = DEFAULT_CAPTION_STYLE;

  it("shows the caption covering t, half-open at its end", () => {
    const clips = [rec("a", 0, 10)];
    const c = caption(2, 4, "hi");
    expect(captionAt(clips, [c], style, 2)?.text).toBe("hi");
    expect(captionAt(clips, [c], style, 3.999)?.text).toBe("hi");
    expect(captionAt(clips, [c], style, 4)).toBeNull();
    expect(captionAt(clips, [c], style, 1.999)).toBeNull();
  });

  it("falls back to the global style, and lets the caption override it", () => {
    const clips = [rec("a", 0, 10)];
    const plain = captionAt(clips, [caption(0, 1, "a")], style, 0.5);
    expect(plain).toMatchObject({ x: style.x, textCase: style.textCase });

    const custom = caption(0, 1, "a", { x: 0.1, textCase: "upper" });
    expect(captionAt(clips, [custom], style, 0.5)).toMatchObject({
      x: 0.1,
      textCase: "upper",
    });
  });

  it("shifts a caption past an appended clip that plays before it", () => {
    const clips = [rec("a", 0, 3), appended("b", 0, 4), rec("c", 3, 10)];
    const c = caption(3.5, 4.5, "later");
    expect(captionAt(clips, [c], style, 8)?.text).toBe("later");
    expect(captionAt(clips, [c], style, 4)).toBeNull(); // over the b-roll
  });

  it("follows a reordered clip", () => {
    const clips = [rec("b", 5, 10), rec("a", 0, 5)];
    const c = caption(1, 2, "late");
    expect(captionAt(clips, [c], style, 6.5)?.text).toBe("late");
    expect(captionAt(clips, [c], style, 1.5)).toBeNull();
  });

  it("drops a caption whose whole source range was cut", () => {
    const clips = [rec("a", 0, 3), rec("b", 6, 10)];
    const c = caption(4, 5, "gone");
    expect(captionAt(clips, [c], style, 3)).toBeNull();
  });

  it("drops every caption once the recording itself is gone", () => {
    const c = caption(1, 2, "orphan");
    expect(captionAt([appended("b", 0, 4)], [c], style, 1)).toBeNull();
  });
});
