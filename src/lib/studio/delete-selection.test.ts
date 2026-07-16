import { describe, expect, it } from "vitest";
import { deleteSelectedFrom } from "@/lib/studio/delete-selection";
import type { EditorState } from "@/lib/studio/history";
import type { AudioTrack, Caption, Clip, Overlay } from "@/lib/studio/types";

const clip = (id: string) => ({ id, start: 0, end: 1 }) as Clip;
const overlay = (id: string) => ({ id }) as Overlay;
const caption = (id: string) => ({ id }) as Caption;
const audio = (id: string) => ({ id }) as AudioTrack;

const state = (): EditorState => ({
  clips: [clip("c1"), clip("c2")],
  overlays: [overlay("o1"), overlay("o2")],
  captions: [caption("cap1"), caption("cap2")],
  audioTracks: [audio("a1"), audio("a2")],
  baseHidden: false,
  baseMuted: true,
});

const noIds = (): {
  clipIds: Set<string>;
  overlayIds: Set<string>;
  captionIds: Set<string>;
  audioIds: Set<string>;
} => ({
  clipIds: new Set(),
  overlayIds: new Set(),
  captionIds: new Set(),
  audioIds: new Set(),
});

describe("deleteSelectedFrom", () => {
  it("removes selected items from every layer in one pass", () => {
    const s = state();
    const out = deleteSelectedFrom(s, {
      clipIds: new Set(["c1"]),
      overlayIds: new Set(["o2"]),
      captionIds: new Set(["cap1"]),
      audioIds: new Set(["a1"]),
    });
    expect(out.clips.map((c) => c.id)).toEqual(["c2"]);
    expect(out.overlays.map((o) => o.id)).toEqual(["o1"]);
    expect(out.captions.map((c) => c.id)).toEqual(["cap2"]);
    expect(out.audioTracks.map((a) => a.id)).toEqual(["a2"]);
    // Non-layer state passes through untouched.
    expect(out.baseMuted).toBe(true);
  });

  it("keeps the exact array reference for a layer with nothing selected", () => {
    const s = state();
    // Only a clip is selected; the other three layers must be the SAME arrays,
    // or the history reducer records a spurious edit on each of them.
    const out = deleteSelectedFrom(s, { ...noIds(), clipIds: new Set(["c1"]) });
    expect(out.overlays).toBe(s.overlays);
    expect(out.captions).toBe(s.captions);
    expect(out.audioTracks).toBe(s.audioTracks);
    expect(out.clips).not.toBe(s.clips); // the touched layer is rebuilt
  });

  it("leaves every layer by reference when nothing is selected", () => {
    const s = state();
    const out = deleteSelectedFrom(s, noIds());
    expect(out.clips).toBe(s.clips);
    expect(out.overlays).toBe(s.overlays);
    expect(out.captions).toBe(s.captions);
    expect(out.audioTracks).toBe(s.audioTracks);
  });

  it("removes only the selected ids, keeping the rest", () => {
    const s = state();
    const out = deleteSelectedFrom(s, { ...noIds(), clipIds: new Set(["c2"]) });
    expect(out.clips.map((c) => c.id)).toEqual(["c1"]);
  });
});
