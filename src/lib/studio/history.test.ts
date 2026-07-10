import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  commit,
  EMPTY_EDITOR_STATE,
  INITIAL_HISTORY,
  redo,
  reset,
  undo,
  type EditorState,
  type History,
} from "@/lib/studio/history";
import type { AudioTrack, Clip, Overlay } from "@/lib/studio/types";

const clip = (id: string): Clip => ({ id, start: 0, end: 1 });

const overlay = (id: string, start = 0): Overlay => ({
  id,
  kind: "video",
  url: "o.mp4",
  name: "o.mp4",
  start,
  duration: 2,
  sourceStart: 0,
});

const audio = (id: string, start = 0): AudioTrack => ({
  id,
  name: "a.mp3",
  url: "a.mp3",
  duration: 3,
  start,
  muted: false,
});

const state = (patch: Partial<EditorState> = {}): EditorState => ({
  ...EMPTY_EDITOR_STATE,
  ...patch,
});

const presentOf = (h: History) => h.present;

describe("commit", () => {
  it("pushes the old present onto the undo stack", () => {
    const a = state({ clips: [clip("a")] });
    const h = commit(INITIAL_HISTORY, a);
    expect(h.present).toBe(a);
    expect(h.past).toEqual([EMPTY_EDITOR_STATE]);
    expect(canUndo(h)).toBe(true);
  });

  it("ignores a commit that changes nothing", () => {
    const h = commit(INITIAL_HISTORY, INITIAL_HISTORY.present);
    expect(h).toBe(INITIAL_HISTORY);
  });

  it("clears the redo stack", () => {
    let h = commit(INITIAL_HISTORY, state({ clips: [clip("a")] }));
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, state({ clips: [clip("b")] }));
    expect(canRedo(h)).toBe(false);
  });

  it("caps the undo depth", () => {
    let h = INITIAL_HISTORY;
    for (let i = 0; i < 250; i++)
      h = commit(h, state({ clips: [clip(`${i}`)] }));
    expect(h.past.length).toBe(200);
    // The most recent steps survive; the oldest fall off the back.
    expect(h.past[h.past.length - 1].clips[0].id).toBe("248");
  });
});

describe("coalescing", () => {
  it("collapses consecutive commits that share a key into one step", () => {
    // One overlay drag: many pointermove events, one undo step.
    let h = commit(
      INITIAL_HISTORY,
      state({ overlays: [overlay("o", 1)] }),
      "g1",
    );
    h = commit(h, state({ overlays: [overlay("o", 2)] }), "g1");
    h = commit(h, state({ overlays: [overlay("o", 3)] }), "g1");
    expect(h.past.length).toBe(1);
    expect(presentOf(h).overlays[0].start).toBe(3);
    expect(presentOf(undo(h))).toBe(EMPTY_EDITOR_STATE);
  });

  it("keeps two separate gestures separately undoable", () => {
    let h = commit(
      INITIAL_HISTORY,
      state({ overlays: [overlay("o", 1)] }),
      "g1",
    );
    h = commit(h, state({ overlays: [overlay("o", 5)] }), "g2");
    expect(h.past.length).toBe(2);
    expect(presentOf(undo(h)).overlays[0].start).toBe(1);
  });

  it("does not coalesce when no key is given", () => {
    let h = commit(INITIAL_HISTORY, state({ clips: [clip("a")] }));
    h = commit(h, state({ clips: [clip("b")] }));
    expect(h.past.length).toBe(2);
  });

  it("a coalesced commit still clears redo", () => {
    let h = commit(INITIAL_HISTORY, state({ clips: [clip("a")] }));
    h = undo(h);
    h = commit(h, state({ overlays: [overlay("o")] }), "g1");
    expect(canRedo(h)).toBe(false);
  });

  it("stops coalescing across an undo", () => {
    let h = commit(
      INITIAL_HISTORY,
      state({ overlays: [overlay("o", 1)] }),
      "g1",
    );
    h = commit(h, state({ overlays: [overlay("o", 2)] }), "g1");
    h = undo(h);
    h = redo(h);
    // The gesture is over; a later commit with the same key must not merge into it.
    h = commit(h, state({ overlays: [overlay("o", 9)] }), "g1");
    expect(h.past.length).toBe(2);
  });
});

describe("undo / redo", () => {
  it("round-trips every layer, not just clips", () => {
    const full = state({
      clips: [clip("a")],
      overlays: [overlay("o")],
      audioTracks: [audio("t")],
      baseHidden: true,
      baseMuted: true,
    });
    let h = commit(INITIAL_HISTORY, full);
    h = undo(h);
    expect(presentOf(h)).toEqual(EMPTY_EDITOR_STATE);
    h = redo(h);
    expect(presentOf(h)).toEqual(full);
  });

  it("undoes an overlay deletion", () => {
    const before = state({ overlays: [overlay("o")] });
    let h = reset(before);
    h = commit(h, state({ overlays: [] }));
    expect(presentOf(h).overlays).toEqual([]);
    expect(presentOf(undo(h)).overlays).toEqual([overlay("o")]);
  });

  it("undoes an audio track move", () => {
    let h = reset(state({ audioTracks: [audio("t", 0)] }));
    h = commit(h, state({ audioTracks: [audio("t", 4)] }), "drag");
    expect(presentOf(undo(h)).audioTracks[0].start).toBe(0);
  });

  it("undoes muting the bottom track", () => {
    let h = reset(state({ baseMuted: false }));
    h = commit(h, state({ baseMuted: true }));
    expect(presentOf(undo(h)).baseMuted).toBe(false);
  });

  it("is a no-op at either end of the stack", () => {
    expect(undo(INITIAL_HISTORY)).toBe(INITIAL_HISTORY);
    expect(redo(INITIAL_HISTORY)).toBe(INITIAL_HISTORY);
  });
});

describe("reset", () => {
  it("drops history and fills unspecified layers with empties", () => {
    let h = commit(INITIAL_HISTORY, state({ clips: [clip("a")] }));
    h = reset({ clips: [clip("b")] });
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(presentOf(h).overlays).toEqual([]);
    expect(presentOf(h).baseHidden).toBe(false);
  });
});
