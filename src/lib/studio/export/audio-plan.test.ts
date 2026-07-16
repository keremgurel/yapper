import { describe, expect, it } from "vitest";
import { planAudioMix } from "@/lib/studio/export/audio-plan";
import type {
  AudioTrack,
  Clip,
  MediaRef,
  Overlay,
  StudioSource,
} from "@/lib/studio/types";

const source: StudioSource = {
  url: "rec.mp4",
  name: "rec",
  duration: 100,
  kind: "video",
};
const clip = (
  id: string,
  start: number,
  end: number,
  src?: MediaRef,
): Clip => ({
  id,
  start,
  end,
  ...(src ? { src } : {}),
});
const imageRef: MediaRef = {
  url: "photo.png",
  name: "photo",
  duration: 5,
  kind: "image",
};
const overlay = (o: Partial<Overlay>): Overlay =>
  ({
    id: "o",
    kind: "video",
    url: "ov.mp4",
    name: "ov",
    track: 0,
    start: 0,
    duration: 4,
    sourceStart: 0,
    ...o,
  }) as Overlay;
const audio = (a: Partial<AudioTrack>): AudioTrack =>
  ({
    id: "a",
    name: "a",
    url: "music.mp3",
    duration: 4,
    start: 0,
    sourceStart: 0,
    mediaDuration: 30,
    muted: false,
    ...a,
  }) as AudioTrack;

const base = {
  source,
  clips: [] as Clip[],
  overlays: [] as Overlay[],
  audioTracks: [] as AudioTrack[],
  baseMuted: false,
};

describe("planAudioMix base track", () => {
  it("places each clip's source range at its accumulated timeline position", () => {
    const out = planAudioMix(
      { ...base, clips: [clip("c1", 0, 2), clip("c2", 5, 8)] },
      100,
    );
    expect(out).toEqual([
      { url: "rec.mp4", when: 0, offset: 0, length: 2 },
      // Second clip sits after the first (cursor = 2), plays from its own
      // in-point 5 for 3s.
      { url: "rec.mp4", when: 2, offset: 5, length: 3 },
    ]);
  });

  it("emits nothing from the base track when it is muted", () => {
    const out = planAudioMix(
      { ...base, baseMuted: true, clips: [clip("c1", 0, 2)] },
      100,
    );
    expect(out).toEqual([]);
  });

  it("skips an image clip but still advances the cursor past it", () => {
    // The image contributes no audio, yet the next clip must land after it, not
    // on top of it, or the whole bed would slide earlier.
    const out = planAudioMix(
      {
        ...base,
        clips: [clip("im", 0, 2, imageRef), clip("cv", 0, 3)],
      },
      100,
    );
    expect(out).toEqual([{ url: "rec.mp4", when: 2, offset: 0, length: 3 }]);
  });
});

describe("planAudioMix overlays", () => {
  it("includes an unmuted, visible video overlay at its own in-point", () => {
    const out = planAudioMix(
      {
        ...base,
        overlays: [
          overlay({ start: 3, duration: 4, sourceStart: 1, muted: false }),
        ],
      },
      100,
    );
    expect(out).toEqual([{ url: "ov.mp4", when: 3, offset: 1, length: 4 }]);
  });

  it("excludes overlays that are muted, hidden, an image, or muted-by-default", () => {
    const out = planAudioMix(
      {
        ...base,
        overlays: [
          overlay({ id: "m", muted: true }),
          overlay({ id: "h", hidden: true, muted: false }),
          overlay({ id: "img", kind: "image", muted: false }),
          overlay({ id: "def" }), // muted flag never set -> muted ?? true
        ],
      },
      100,
    );
    expect(out).toEqual([]);
  });
});

describe("planAudioMix audio tracks", () => {
  it("includes unmuted tracks and drops muted ones", () => {
    const out = planAudioMix(
      {
        ...base,
        audioTracks: [
          audio({ id: "keep", start: 2, sourceStart: 1, duration: 5 }),
          audio({ id: "drop", muted: true }),
        ],
      },
      100,
    );
    expect(out).toEqual([{ url: "music.mp3", when: 2, offset: 1, length: 5 }]);
  });
});

describe("planAudioMix inaudible-slice guard", () => {
  it("drops a slice that starts at or past the project end", () => {
    const out = planAudioMix(
      { ...base, audioTracks: [audio({ start: 10, duration: 4 })] },
      10,
    );
    expect(out).toEqual([]);
  });

  it("drops a zero-or-negative-length slice", () => {
    const out = planAudioMix({ ...base, clips: [clip("z", 4, 4)] }, 100);
    expect(out).toEqual([]);
  });
});
