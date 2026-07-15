import { describe, expect, it } from "vitest";
import { duplicatedOverlayPosition } from "@/lib/studio/duplicate";
import type { Overlay } from "@/lib/studio/types";

function overlay(fields: Partial<Overlay> & { id: string }): Overlay {
  return {
    kind: "video",
    url: "blob:x",
    name: "clip",
    track: 0,
    start: 0,
    duration: 2,
    sourceStart: 0,
    ...fields,
  };
}

describe("duplicatedOverlayPosition", () => {
  it("places the copy right after the original", () => {
    const o = overlay({ id: "a", start: 3, duration: 2, track: 1 });
    expect(duplicatedOverlayPosition([o], o).start).toBe(5);
  });

  it("keeps the copy on the original's track when that lane is free after it", () => {
    const o = overlay({ id: "a", start: 3, duration: 2, track: 1 });
    expect(duplicatedOverlayPosition([o], o).track).toBe(1);
  });

  it("moves the copy to a free track when the original's lane is occupied there", () => {
    const o = overlay({ id: "a", start: 3, duration: 2, track: 1 });
    // Something already sits on track 1 across where the copy would go (5..7).
    const blocker = overlay({ id: "b", start: 5, duration: 2, track: 1 });
    const track = duplicatedOverlayPosition([o, blocker], o).track;
    expect(track).not.toBe(1);
    expect(track).toBe(0); // track 0 is free at 5..7
  });
});
