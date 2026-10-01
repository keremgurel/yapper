import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RotaryKnob from "./RotaryKnob";

describe("timer dial", () => {
  it("keeps equally sized, evenly spaced ticks at short and long duration ranges", () => {
    const marks = (max: number) => {
      const markup = renderToStaticMarkup(
        createElement(RotaryKnob, {
          value: 60,
          min: 30,
          max,
          onChange: () => {},
        }),
      );
      return [...markup.matchAll(/<line\b[^>]+>/g)].map(([line]) => {
        const coordinate = (name: string) =>
          Number(line.match(new RegExp(`${name}="([^"]+)"`))![1]);
        return {
          x: coordinate("x1"),
          y: coordinate("y1"),
          length: Math.hypot(
            coordinate("x2") - coordinate("x1"),
            coordinate("y2") - coordinate("y1"),
          ),
        };
      });
    };
    const short = marks(90),
      long = marks(600);
    expect(short).toEqual(long);
    expect(long).toHaveLength(49);
    for (const tick of long) expect(tick.length).toBeCloseTo(9);
    const distance = Math.hypot(long[1].x - long[0].x, long[1].y - long[0].y);
    for (let i = 1; i < long.length; i++)
      expect(
        Math.hypot(long[i].x - long[i - 1].x, long[i].y - long[i - 1].y),
      ).toBeCloseTo(distance);
  });
});
