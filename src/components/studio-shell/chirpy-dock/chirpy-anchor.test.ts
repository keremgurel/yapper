import { describe, expect, it } from "vitest";
import {
  clampToViewport,
  initialAnchor,
  panelFrame,
} from "@/components/studio-shell/chirpy-dock/chirpy-anchor";

const bird = { width: 72, height: 72 };
const desktop = { width: 1280, height: 800 };
const panel = { width: 560, height: 600 };

describe("chirpy anchor", () => {
  it("starts in the bottom right corner", () => {
    expect(initialAnchor(bird, desktop)).toEqual({ x: 1192, y: 712 });
  });

  it("keeps the bird inside a smaller window", () => {
    expect(
      clampToViewport({ x: 1192, y: 712 }, bird, { width: 400, height: 500 }),
    ).toEqual({ x: 312, y: 412 });
  });
});

describe("panelFrame", () => {
  it("grows up and left out of a bird in the bottom right corner", () => {
    const frame = panelFrame({ x: 1192, y: 712 }, bird, panel, desktop);
    expect(frame.x + frame.width).toBe(1192 + 72);
    expect(frame.y + frame.height).toBe(712 + 72);
    expect(frame.origin).toBe("right bottom");
  });

  it("grows down and right out of a bird near the top left", () => {
    const frame = panelFrame({ x: 40, y: 40 }, bird, panel, desktop);
    expect(frame).toMatchObject({ x: 40, y: 40, origin: "left top" });
  });

  it("shrinks to fit a small window", () => {
    const frame = panelFrame({ x: 300, y: 500 }, bird, panel, {
      width: 375,
      height: 640,
    });
    expect(frame.width).toBe(375 - 32);
    expect(frame.x).toBe(16);
    expect(frame.y + frame.height).toBeLessThanOrEqual(640 - 16);
  });
});
