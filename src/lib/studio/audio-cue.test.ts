import { describe, expect, it } from "vitest";
import { audioCue } from "@/lib/studio/audio-cue";
import type { AudioTrack } from "@/lib/studio/types";

function track(fields: Partial<AudioTrack>): AudioTrack {
  return {
    id: "a",
    name: "music",
    url: "blob:m",
    start: 0,
    duration: 10,
    sourceStart: 0,
    mediaDuration: 30,
    muted: false,
    ...fields,
  };
}

describe("audioCue", () => {
  it("targets the raw local time for an untrimmed clip", () => {
    // start 2, no in-point: at master 5 the file should be at 3s in.
    const cue = audioCue(track({ start: 2, sourceStart: 0 }), 5, true);
    expect(cue).toEqual({ active: true, target: 3 });
  });

  it("adds the clip's in-point for a trimmed / split clip", () => {
    // Clip plays media [4, 14) over timeline [2, 12). At master 5 the playhead
    // is 3s into the clip, so the file must be at 4 + 3 = 7s, not 3s.
    const cue = audioCue(track({ start: 2, sourceStart: 4 }), 5, true);
    expect(cue.target).toBe(7);
    expect(cue.active).toBe(true);
  });

  it("is inactive before the clip starts", () => {
    expect(audioCue(track({ start: 2 }), 1, true).active).toBe(false);
  });

  it("is inactive once the playhead passes the clip's timeline span", () => {
    // duration is the on-timeline length, so the bound uses duration even
    // though the media in-point is offset.
    expect(
      audioCue(track({ start: 2, duration: 10, sourceStart: 4 }), 12, true)
        .active,
    ).toBe(false);
  });

  it("is inactive when muted or paused", () => {
    expect(audioCue(track({ start: 0, muted: true }), 3, true).active).toBe(
      false,
    );
    expect(audioCue(track({ start: 0 }), 3, false).active).toBe(false);
  });
});
