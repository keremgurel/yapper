import { describe, expect, it } from "vitest";
import {
  compactTracks,
  firstFreeTrack,
  moveToTrack,
  overlaysOnTrack,
  paintOrder,
  topTrack,
  trackCount,
  trackOccupied,
} from "@/lib/studio/tracks";
import type { Overlay } from "@/lib/studio/types";

const ov = (id: string, track: number, start = 0, duration = 1): Overlay => ({
  id,
  kind: "video",
  url: `${id}.mp4`,
  name: `${id}.mp4`,
  track,
  start,
  duration,
  sourceStart: 0,
});

describe("topTrack / trackCount", () => {
  it("reports nothing for an empty timeline", () => {
    expect(topTrack([])).toBe(-1);
    expect(trackCount([])).toBe(0);
  });

  it("counts up to the highest track in use, gaps and all", () => {
    expect(topTrack([ov("a", 0), ov("b", 3)])).toBe(3);
    expect(trackCount([ov("a", 0), ov("b", 3)])).toBe(4);
  });
});

describe("overlaysOnTrack", () => {
  it("takes only the track asked for", () => {
    const all = [ov("a", 0), ov("b", 1), ov("c", 0)];
    expect(overlaysOnTrack(all, 0).map((o) => o.id)).toEqual(["a", "c"]);
    expect(overlaysOnTrack(all, 2)).toEqual([]);
  });
});

describe("trackOccupied", () => {
  const all = [ov("a", 0, 2, 3)]; // track 0, seconds 2..5

  it("sees an overlap", () => {
    expect(trackOccupied(all, 0, { id: "b", start: 4, duration: 2 })).toBe(
      true,
    );
  });

  it("lets clips sit edge to edge", () => {
    expect(trackOccupied(all, 0, { id: "b", start: 5, duration: 2 })).toBe(
      false,
    );
    expect(trackOccupied(all, 0, { id: "b", start: 0, duration: 2 })).toBe(
      false,
    );
  });

  it("ignores the same clip, so a clip never blocks its own move", () => {
    expect(trackOccupied(all, 0, { id: "a", start: 2, duration: 3 })).toBe(
      false,
    );
  });

  it("only looks at the track asked for", () => {
    expect(trackOccupied(all, 1, { id: "b", start: 2, duration: 3 })).toBe(
      false,
    );
  });
});

describe("firstFreeTrack", () => {
  it("uses track 0 on an empty timeline", () => {
    expect(firstFreeTrack([], { id: "n", start: 0, duration: 2 })).toBe(0);
  });

  it("shares a track when the new clip fits beside what is there", () => {
    const all = [ov("a", 0, 0, 2)];
    expect(firstFreeTrack(all, { id: "n", start: 4, duration: 2 })).toBe(0);
  });

  it("climbs past every track that is busy at that instant", () => {
    const all = [ov("a", 0, 0, 5), ov("b", 1, 0, 5)];
    expect(firstFreeTrack(all, { id: "n", start: 1, duration: 1 })).toBe(2);
  });

  it("takes the lowest free track, not the highest", () => {
    const all = [ov("a", 0, 0, 5), ov("b", 1, 0, 5), ov("c", 2, 9, 1)];
    expect(firstFreeTrack(all, { id: "n", start: 6, duration: 1 })).toBe(0);
  });
});

describe("compactTracks", () => {
  it("closes a gap left by an emptied track", () => {
    const out = compactTracks([ov("a", 0), ov("b", 2), ov("c", 5)]);
    expect(out.map((o) => o.track)).toEqual([0, 1, 2]);
  });

  it("leaves already-tight tracks alone, identity and all", () => {
    const input = [ov("a", 0), ov("b", 1)];
    const out = compactTracks(input);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
  });

  it("keeps clips that share a track together", () => {
    const out = compactTracks([ov("a", 3), ov("b", 7), ov("c", 3)]);
    expect(out.map((o) => o.track)).toEqual([0, 1, 0]);
  });
});

describe("moveToTrack", () => {
  it("drops a clip into a hole on a lower track", () => {
    // `b` sits alone on track 1; track 0 is free from 5s on.
    const all = [ov("a", 0, 0, 4), ov("b", 1, 6, 2)];
    const out = moveToTrack(all, "b", 0);
    expect(out.map((o) => o.track)).toEqual([0, 0]);
  });

  it("refuses a move onto a clip already there", () => {
    const all = [ov("a", 0, 0, 4), ov("b", 1, 2, 2)];
    expect(moveToTrack(all, "b", 0)).toBe(all);
  });

  it("closes the track the clip left behind", () => {
    // Moving `c` down from track 2 empties it, so `b` slides from 1 to 1 and
    // nothing is left blank above.
    const all = [ov("a", 0, 0, 2), ov("b", 1, 0, 2), ov("c", 2, 5, 2)];
    const out = moveToTrack(all, "c", 0);
    expect(out.map((o) => [o.id, o.track])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("promotes a clip to a brand new top track", () => {
    const all = [ov("a", 0, 0, 2), ov("b", 0, 5, 2)];
    const out = moveToTrack(all, "b", 1);
    expect(out.map((o) => o.track)).toEqual([0, 1]);
  });

  it("compacts a lone clip's promotion back down to where it was", () => {
    // Nothing is under it, so a new track above would be an empty lane.
    const all = [ov("a", 0, 0, 2)];
    expect(moveToTrack(all, "a", 1).map((o) => o.track)).toEqual([0]);
  });

  it("never moves a clip below track 0", () => {
    const all = [ov("a", 1, 0, 2)];
    expect(moveToTrack(all, "a", -3).map((o) => o.track)).toEqual([0]);
  });

  it("is a no-op for a clip that is not there", () => {
    const all = [ov("a", 0)];
    expect(moveToTrack(all, "nope", 1)).toBe(all);
  });

  it("is a no-op when the clip is already on that track", () => {
    const all = [ov("a", 1, 0, 2)];
    expect(moveToTrack(all, "a", 1)).toBe(all);
  });
});

describe("paintOrder", () => {
  it("paints the bottom track first so the top one wins", () => {
    const out = paintOrder([ov("a", 2), ov("b", 0), ov("c", 1)]);
    expect(out.map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps array order among clips on the same track", () => {
    const out = paintOrder([ov("a", 1), ov("b", 1), ov("c", 0)]);
    expect(out.map((o) => o.id)).toEqual(["c", "a", "b"]);
  });
});
