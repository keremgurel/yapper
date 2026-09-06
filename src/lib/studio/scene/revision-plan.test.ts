import { expect, it, vi, beforeEach } from "vitest";
import { withOpeningHold, planRevision } from "./revision-plan";
import { validateScene } from "./scene-validate";
const call = vi.hoisted(() => vi.fn());
vi.mock("./scene-model-call", () => ({ callSceneModel: call }));
const raw = {
  version: 1,
  duration: 4.2,
  poster: 2.6,
  nodes: [
    {
      id: "count",
      type: "number",
      from: 324,
      to: 553,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      size: 0.3,
    },
  ],
  animations: [
    { node: "count", property: "opacity", from: 0, to: 1, start: 0, end: 0.3 },
    { node: "count", property: "value", from: 0, to: 1, start: 0.7, end: 2.5 },
    { node: "*", property: "opacity", from: 1, to: 0, start: 3.9, end: 4.2 },
  ],
};
beforeEach(() => call.mockReset());
it("extends the opening without changing values, design, transition length or final hold", () => {
  const original = validateScene(raw)!.scene;
  const scene = withOpeningHold(original, 3);
  expect(scene.nodes).toEqual(original.nodes);
  expect(scene.duration).toBeCloseTo(6.5);
  expect(scene.animations[0]).toEqual(original.animations[0]);
  expect(scene.animations[1].start).toBe(3);
  expect(scene.animations[1].end).toBeCloseTo(4.8);
  expect(scene.animations[2].end).toBeCloseTo(6.5);
  expect(original.duration).toBe(4.2);
});
it("does not repeatedly add another hold when the same edit is requested twice", () => {
  const scene = withOpeningHold(validateScene(raw)!.scene, 3);
  expect(withOpeningHold(scene, 3)).toEqual(scene);
});
it("refuses to silently stretch a segment crossing the insertion point", () => {
  const scene = validateScene({
    ...raw,
    animations: [
      ...raw.animations,
      { node: "count", property: "x", from: 0, to: 0.2, start: 0.5, end: 1 },
    ],
  })!.scene;
  expect(() => withOpeningHold(scene, 3)).toThrow("complex_opening_hold");
});
it("preserves combined operations from the interpreter", async () => {
  const plan = {
    openingHoldSeconds: 3,
    duration: null,
    sceneInstruction: null,
    placementQuote: null,
    timelineShiftSeconds: -2,
  };
  call.mockResolvedValue({ content: JSON.stringify(plan) });
  const input = {
    op: "edit" as const,
    instruction: "Hold for 3 seconds and move 2 seconds earlier",
    words: [],
    asset: {
      name: "Counter",
      description: "",
      brief: "",
      quote: "",
      scene: raw,
    },
    box: { widthPx: 255, heightPx: 159, aspect: 255 / 159 },
    duration: 4.2,
    frameAspect: 9 / 16,
    frameHeightPx: 1080,
  };
  expect(await planRevision(input, "model")).toEqual(plan);
});
