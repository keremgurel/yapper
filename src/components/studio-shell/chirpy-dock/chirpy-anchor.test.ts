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
  it("opens above a bird in the bottom right, sharing its right edge", () => {
    const frame = panelFrame({ x: 1192, y: 712 }, bird, panel, desktop);
    expect(frame.x + frame.width).toBe(1192 + 72);
    expect(frame.y + frame.height).toBeLessThanOrEqual(712 - 12);
  });

  it("opens below a bird near the top and shrinks to fit, never covering it", () => {
    const frame = panelFrame({ x: 205, y: 160 }, bird, panel, desktop);
    expect(frame.x).toBe(205);
    expect(frame.y).toBe(160 + 72 + 12);
    expect(frame.y + frame.height).toBeLessThanOrEqual(800 - 16);
  });

  it("sits beside the bird when neither side is tall enough", () => {
    const frame = panelFrame({ x: 40, y: 260 }, bird, panel, {
      width: 1280,
      height: 600,
    });
    expect(frame.x).toBe(40 + 72 + 12);
  });
});
