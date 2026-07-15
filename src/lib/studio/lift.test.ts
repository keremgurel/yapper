import { describe, expect, it } from "vitest";
import { liftedOverlayFromClip } from "@/lib/studio/lift";
import type { Clip, StudioSource } from "@/lib/studio/types";

const source: StudioSource = {
  url: "rec.mp4",
  name: "Recording",
  duration: 60,
  kind: "video",
};

const broll: Clip["src"] = {
  url: "broll.mp4",
  kind: "video",
  name: "B-roll",
  duration: 200,
};

describe("liftedOverlayFromClip", () => {
  it("references the base recording for a plain clip", () => {
    const o = liftedOverlayFromClip({ id: "c", start: 4, end: 9 }, source, 2);
    expect(o).toMatchObject({
      url: "rec.mp4",
      name: "Recording",
      sourceStart: 4,
      duration: 5,
      start: 2,
      muted: true,
    });
  });

  it("keeps an appended clip's OWN media, not the recording", () => {
    // The bug this guards: a clip with its own src used to lift pointing at the
    // base recording (rec.mp4) at the appended clip's source time (100s), so it
    // showed the wrong footage. It must carry broll.mp4 instead.
    const clip: Clip = { id: "c", start: 100, end: 103, src: broll };
    const o = liftedOverlayFromClip(clip, source, 0);
    expect(o?.url).toBe("broll.mp4");
    expect(o?.name).toBe("B-roll");
    expect(o?.sourceStart).toBe(100);
    expect(o?.duration).toBe(3);
  });

  it("still lifts with no base recording, using the clip's own media", () => {
    const clip: Clip = { id: "c", start: 0, end: 2, src: broll };
    expect(liftedOverlayFromClip(clip, null, 0)?.url).toBe("broll.mp4");
  });

  it("returns null when a plain clip has no recording to reference", () => {
    expect(
      liftedOverlayFromClip({ id: "c", start: 0, end: 2 }, null, 0),
    ).toBeNull();
  });

  it("clamps the timeline start to 0 and the duration to a floor", () => {
    const o = liftedOverlayFromClip({ id: "c", start: 1, end: 1 }, source, -5);
    expect(o?.start).toBe(0);
    expect(o?.duration).toBe(0.1);
  });
});
