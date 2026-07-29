import { describe, expect, it } from "vitest";
import { filmstripCells } from "@/lib/studio/filmstrip-cells";

const frames = [
  { time: 1, src: "one" },
  { time: 3, src: "three" },
  { time: 5, src: "five" },
];

describe("filmstripCells", () => {
  it("anchors each thumbnail to the same source-time cell at every zoom", () => {
    const normal = filmstripCells(frames, 0, 6, 600);
    const zoomed = filmstripCells(frames, 0, 6, 1200);

    expect(normal.map((cell) => cell.frame.src)).toEqual([
      "one",
      "three",
      "five",
    ]);
    expect(normal.map((cell) => [cell.left, cell.width])).toEqual([
      [0, 200],
      [200, 200],
      [400, 200],
    ]);
    expect(zoomed.map((cell) => [cell.left, cell.width])).toEqual([
      [0, 400],
      [400, 400],
      [800, 400],
    ]);
  });

  it("clips cells to a window without changing their frame identity", () => {
    const visible = filmstripCells(frames, 2.5, 4.5, 200);
    expect(visible.map((cell) => cell.frame.src)).toEqual(["three", "five"]);
    expect(visible.map((cell) => [cell.left, cell.width])).toEqual([
      [0, 150],
      [150, 50],
    ]);
  });
});
