import { describe, expect, it } from "vitest";
import { anchorAfterResize, type Anchor } from "@/hooks/use-draggable-anchor";

const SIZE = 56;
const corner = ({ w, h }: { w: number; h: number }): Anchor => ({
  x: w - SIZE - 20,
  y: h - SIZE - 20,
});

describe("draggable anchor resizing", () => {
  it("keeps an untouched helper docked to the bottom-right", () => {
    expect(
      anchorAfterResize(
        corner({ w: 1_000, h: 700 }),
        SIZE,
        { w: 1_500, h: 900 },
        false,
        corner,
      ),
    ).toEqual({ x: 1_424, y: 824 });
  });

  it("preserves a manually chosen position when the viewport grows", () => {
    expect(
      anchorAfterResize(
        { x: 240, y: 180 },
        SIZE,
        { w: 1_500, h: 900 },
        true,
        corner,
      ),
    ).toEqual({ x: 240, y: 180 });
  });

  it("pulls a manually chosen position onscreen when the viewport shrinks", () => {
    expect(
      anchorAfterResize(
        { x: 1_200, y: 800 },
        SIZE,
        { w: 900, h: 600 },
        true,
        corner,
      ),
    ).toEqual({ x: 832, y: 532 });
  });
});
