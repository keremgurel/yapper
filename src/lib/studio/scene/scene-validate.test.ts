import { describe, expect, it } from "vitest";
import { validateScene } from "@/lib/studio/scene/scene-validate";

const counter = {
  version: 1,
  duration: 4.2,
  poster: 1.8,
  background: { fill: "brand.surface", cornerRadius: 0.08 },
  nodes: [
    {
      id: "label",
      type: "text",
      text: "Customers",
      font: "modern",
      weight: "semibold",
      size: 0.09,
      color: "brand.ink",
      x: 0.08,
      y: 0.18,
      width: 0.84,
    },
    {
      id: "count",
      type: "number",
      from: 1200,
      to: 2850,
      format: "grouped",
      size: 0.34,
      color: "brand.primary",
      x: 0.08,
      y: 0.36,
      width: 0.84,
    },
    {
      id: "bar",
      type: "rect",
      fill: "brand.primary",
      anchor: "left",
      x: 0.08,
      y: 0.8,
      width: 0.84,
      height: 0.06,
      cornerRadius: 0.03,
    },
  ],
  animations: [
    { node: "*", property: "opacity", from: 0, to: 1, start: 0, end: 0.25 },
    { node: "count", property: "value", from: 0, to: 1, start: 0.3, end: 1.6 },
    {
      node: "bar",
      property: "scaleX",
      from: 0.42,
      to: 1,
      start: 0.3,
      end: 1.6,
      easing: "outCubic",
    },
  ],
};

describe("validateScene", () => {
  it("accepts the worked example and fills defaults", () => {
    const result = validateScene(counter);
    expect(result).not.toBeNull();
    const scene = result!.scene;
    expect(scene.nodes).toHaveLength(3);
    expect(scene.animations).toHaveLength(3);
    expect(scene.animations[0].easing).toBe("outCubic");
    expect(scene.background?.fill).toBe("brand.surface");
    expect(scene.nodes[0]).toMatchObject({
      type: "text",
      height: expect.any(Number),
    });
    expect(result!.notes).toEqual([]);
  });

  it("rejects what has no duration or nothing drawable", () => {
    expect(validateScene({ nodes: [] })).toBeNull();
    expect(
      validateScene({ duration: 3, nodes: [{ type: "blob" }] }),
    ).toBeNull();
    expect(validateScene({ ...counter, version: 2 })).toBeNull();
    expect(validateScene("nope")).toBeNull();
  });

  it("drops unknown node types, bad icons and undelivered images with a note", () => {
    const result = validateScene({
      duration: 3,
      nodes: [
        { id: "a", type: "sparkline", x: 0, y: 0, width: 1, height: 1 },
        {
          id: "b",
          type: "icon",
          icon: "not-an-icon",
          x: 0,
          y: 0,
          width: 0.2,
          height: 0.2,
        },
        {
          id: "c",
          type: "image",
          asset: "image:hero",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        {
          id: "d",
          type: "icon",
          icon: "arrow-right",
          x: 0,
          y: 0,
          width: 0.2,
          height: 0.2,
        },
      ],
    });
    expect(result!.scene.nodes.map((n) => n.id)).toEqual(["d"]);
    expect(result!.notes).toHaveLength(3);
  });

  it("keeps an image the reply delivered", () => {
    const result = validateScene(
      {
        duration: 3,
        nodes: [
          {
            id: "c",
            type: "image",
            asset: "image:hero",
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ],
      },
      { imageKeys: ["hero"] },
    );
    expect(result!.scene.nodes[0]).toMatchObject({
      type: "image",
      asset: "image:hero",
      fit: "contain",
    });
  });

  it("clamps fractions and durations instead of failing", () => {
    const result = validateScene({
      duration: 400,
      nodes: [
        {
          id: "r",
          type: "rect",
          x: 9,
          y: -9,
          width: 5,
          height: 0.2,
          cornerRadius: 3,
        },
      ],
      animations: [
        { node: "r", property: "opacity", to: 1, start: -1, end: 999 },
      ],
    });
    const rect = result!.scene.nodes[0];
    expect(result!.scene.duration).toBe(30);
    expect(rect).toMatchObject({
      x: 1.5,
      y: -0.5,
      width: 1.5,
      cornerRadius: 1,
    });
    expect(result!.scene.animations[0]).toMatchObject({ start: 0, end: 30 });
  });

  it("flags illegible text without corrupting its layout", () => {
    const result = validateScene(
      {
        duration: 3,
        nodes: [
          {
            id: "t",
            type: "text",
            text: "tiny",
            size: 0.02,
            x: 0,
            y: 0,
            width: 1,
          },
        ],
      },
      { frameHeightPx: 1920, boxHeightPx: 400 },
    );
    const text = result!.scene.nodes[0] as { size: number };
    expect(text.size).toBe(0.02);
    expect(result!.notes[0]).toMatch(/needs redesign/);
  });

  it("refuses value animations on anything but a number", () => {
    const result = validateScene({
      duration: 3,
      nodes: [{ id: "t", type: "text", text: "x", x: 0, y: 0, width: 1 }],
      animations: [{ node: "t", property: "value", to: 1, start: 0, end: 1 }],
    });
    expect(result!.scene.animations).toEqual([]);
    expect(result!.notes[0]).toMatch(/no value/);
  });

  it("caps nodes and staggered animations", () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      id: `n${i}`,
      type: "rect",
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
    }));
    const result = validateScene({
      duration: 3,
      nodes: many,
      animations: [
        {
          node: "*",
          property: "opacity",
          to: 1,
          start: 0,
          end: 1,
          stagger: 0.05,
        },
        {
          node: "*",
          property: "scale",
          to: 1,
          start: 0,
          end: 1,
          stagger: 0.05,
        },
      ],
    });
    // 64 staggered copies fit in a budget of 96; a second 64 do not.
    expect(result!.scene.nodes).toHaveLength(64);
    expect(result!.scene.animations).toHaveLength(1);
    expect(result!.notes.some((n) => /limit/.test(n))).toBe(true);
  });

  it("de-duplicates ids and validates group children", () => {
    const result = validateScene({
      duration: 3,
      nodes: [
        { id: "a", type: "rect", x: 0, y: 0, width: 0.1, height: 0.1 },
        {
          id: "a",
          type: "group",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          children: [
            { id: "a", type: "ellipse", x: 0, y: 0, width: 0.1, height: 0.1 },
            { type: "nope" },
          ],
        },
      ],
      animations: [
        {
          node: "a-2",
          property: "scale",
          from: 0,
          to: 1,
          start: 0,
          end: 1,
          stagger: 0.1,
        },
      ],
    });
    const ids = result!.scene.nodes.map((n) => n.id);
    expect(ids).toEqual(["a", "a-2"]);
    expect(result!.scene.animations[0].node).toBe("a-2");
  });
});
