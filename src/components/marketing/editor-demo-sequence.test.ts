import { describe, expect, it } from "vitest";
import {
  editSegments,
  editorFrameCount,
  getEditState,
  sourceDuration,
} from "./editor-demo-sequence";

describe("marketing editor sequence", () => {
  it("keeps all seven useful passages and removes three retakes and three pauses", () => {
    const original = getEditState(0);
    const final = getEditState(editorFrameCount - 1);
    expect(sourceDuration).toBe(123);
    expect(original.duration).toBe(123);
    expect(final.duration).toBe(90);
    expect(
      final.clips.filter((clip) => clip.deleted && clip.kind === "retake"),
    ).toHaveLength(3);
    expect(
      final.clips.filter((clip) => clip.deleted && clip.kind === "pause"),
    ).toHaveLength(3);
    expect(
      final.clips.filter((clip) => !clip.deleted).map((clip) => clip.text),
    ).toEqual(
      editSegments
        .filter((clip) => clip.kind === "keep")
        .map((clip) => clip.text),
    );
  });
  it("removes each category as one batch, with retakes before pauses", () => {
    const retakes = editSegments.filter((segment) => segment.kind === "retake");
    const pauses = editSegments.filter((segment) => segment.kind === "pause");
    expect(new Set(retakes.map((segment) => segment.removeAt)).size).toBe(1);
    expect(new Set(pauses.map((segment) => segment.removeAt)).size).toBe(1);
    expect(retakes[0].removeAt).toBeLessThan(pauses[0].removeAt!);
    expect(getEditState(retakes[0].removeAt!).duration).toBe(105);
    expect(getEditState(pauses[0].removeAt!).duration).toBe(90);
  });
  it("selects each cut before deleting it and closes every resulting gap", () => {
    for (const cut of editSegments.filter(
      (segment) => segment.removeAt !== undefined,
    )) {
      const selected = getEditState(cut.removeAt! - 1).clips.find(
        (clip) => clip.start === cut.start,
      )!;
      expect(selected.selected).toBe(true);
      expect(selected.deleted).toBe(false);
      expect(
        getEditState(cut.removeAt!).clips.find(
          (clip) => clip.start === cut.start,
        )!.deleted,
      ).toBe(true);
      const kept = getEditState(cut.removeAt! + 1).clips.filter(
        (clip) => !clip.deleted,
      );
      for (let i = 1; i < kept.length; i++)
        expect(kept[i].offset).toBe(kept[i - 1].offset + kept[i - 1].duration);
    }
  });
  it("never moves a surviving clip outside the timeline or changes its source time", () => {
    for (let frame = 0; frame < editorFrameCount; frame++) {
      const state = getEditState(frame);
      expect(state.duration).toBeGreaterThanOrEqual(90);
      for (const [index, clip] of state.clips.entries()) {
        expect(clip.start).toBe(editSegments[index].start);
        if (!clip.deleted) {
          expect(clip.offset).toBeGreaterThanOrEqual(0);
          expect(clip.offset + clip.duration).toBeLessThanOrEqual(
            sourceDuration,
          );
        }
      }
    }
  });
});
