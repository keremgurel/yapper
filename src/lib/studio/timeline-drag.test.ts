import { describe, expect, it } from "vitest";
import { moveClipTo } from "@/lib/studio/clips";
import { dropIndexAt } from "@/lib/studio/timeline-drag";
import type { Clip } from "@/lib/studio/types";

/** Three one-second clips, resting at timeline 0..1, 1..2, 2..3. */
const abc = (): Clip[] => [
  { id: "a", start: 0, end: 1 },
  { id: "b", start: 0, end: 1 },
  { id: "c", start: 0, end: 1 },
];

/** Drag `id` so its center sits at `centerSec`, and report the new order. */
const dropped = (clips: Clip[], id: string, centerSec: number) =>
  moveClipTo(clips, id, dropIndexAt(clips, id, centerSec)).map((c) => c.id);

describe("dropIndexAt", () => {
  it("leaves a clip where it is when it has passed nobody", () => {
    expect(dropIndexAt(abc(), "a", 0.5)).toBe(0);
    expect(dropped(abc(), "a", 0.5)).toEqual(["a", "b", "c"]);
  });

  it("counts the clips whose middle the dragged one has passed", () => {
    // Past b's middle (1.5) but not c's (2.5).
    expect(dropIndexAt(abc(), "a", 2.0)).toBe(1);
    expect(dropped(abc(), "a", 2.0)).toEqual(["b", "a", "c"]);
  });

  it("drops a clip at the end once it clears the last middle", () => {
    expect(dropIndexAt(abc(), "a", 2.9)).toBe(2);
    expect(dropped(abc(), "a", 2.9)).toEqual(["b", "c", "a"]);
  });

  it("drops a clip at the front when dragged left of every middle", () => {
    expect(dropIndexAt(abc(), "c", 0.2)).toBe(0);
    expect(dropped(abc(), "c", 0.2)).toEqual(["c", "a", "b"]);
  });

  it("ignores the dragged clip's own middle", () => {
    // Without the id check, c's center resting at 2.5 would count itself.
    expect(dropIndexAt(abc(), "c", 2.5)).toBe(2);
    expect(dropped(abc(), "c", 2.5)).toEqual(["a", "b", "c"]);
  });

  it("measures middles against the resting timeline, gap included", () => {
    // The dragged clip's slot stays empty while it is dragged, so b's middle is
    // still 1.5 and not 0.5. Dropping a at 1.4 must not pass b.
    expect(dropIndexAt(abc(), "a", 1.4)).toBe(0);
    expect(dropped(abc(), "a", 1.4)).toEqual(["a", "b", "c"]);
  });

  it("puts a long clip's middle where its length says, not at its start", () => {
    // a runs 0..4, so you must drag b back past 2.0 to overtake it, not past 0.5.
    const clips: Clip[] = [
      { id: "a", start: 0, end: 4 },
      { id: "b", start: 0, end: 1 },
    ];
    expect(dropIndexAt(clips, "b", 2.1)).toBe(1);
    expect(dropIndexAt(clips, "b", 1.9)).toBe(0);
    expect(dropped(clips, "b", 1.9)).toEqual(["b", "a"]);
  });

  it("counts an appended clip like any other, by its timeline length", () => {
    // b carries its own media. Its source range is its own file's seconds, but
    // its LENGTH is what places it on the timeline, so it is measured like a
    // recording clip.
    const clips: Clip[] = [
      { id: "a", start: 0, end: 2 },
      {
        id: "b",
        start: 8,
        end: 10,
        src: { url: "b.mp4", kind: "video", name: "b.mp4", duration: 30 },
      },
      { id: "c", start: 2, end: 4 },
    ];
    // Middles sit at 1, 3, 5 on the timeline. Nothing reads b's 8..10.
    expect(dropIndexAt(clips, "c", 0.5)).toBe(0);
    expect(dropIndexAt(clips, "c", 2.0)).toBe(1);
    expect(dropIndexAt(clips, "c", 3.5)).toBe(2);
  });

  it("is a no-op for a clip that is not there", () => {
    expect(dropIndexAt(abc(), "gone", 10)).toBe(3);
    expect(moveClipTo(abc(), "gone", 3).map((c) => c.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("handles an empty timeline", () => {
    expect(dropIndexAt([], "a", 5)).toBe(0);
  });
});
