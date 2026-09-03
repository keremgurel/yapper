import { describe, expect, it, vi } from "vitest";
import { validateScene } from "./scene-validate";
import { sceneQualityIssues } from "./scene-quality";
import { designChecked } from "./design-checked";
import { callSceneModel } from "./scene-model-call";
import { requestedMomentLimit } from "./direct-reply";
import { boxLines } from "./prompts/design-prompt";
vi.mock("./scene-model-call", () => ({ callSceneModel: vi.fn() }));
const box = { widthPx: 280, heightPx: 180, frameHeightPx: 1080 };
const good = {
  version: 1,
  duration: 4,
  nodes: [
    {
      id: "label",
      type: "text",
      text: "SIGNUPS",
      x: 0.08,
      y: 0.08,
      width: 0.84,
      height: 0.2,
      size: 0.14,
    },
    {
      id: "value",
      type: "number",
      from: 324,
      to: 553,
      x: 0.08,
      y: 0.35,
      width: 0.84,
      height: 0.5,
      size: 0.36,
    },
  ],
  animations: [
    { node: "value", property: "value", from: 0, to: 1, start: 0.5, end: 1.8 },
  ],
};
describe("scene quality", () => {
  it("repairs a truncated response without parsing or delivering the fragment", async () => {
    vi.mocked(callSceneModel).mockReset();
    vi.mocked(callSceneModel)
      .mockRejectedValueOnce(new Error("answer_truncated"))
      .mockResolvedValueOnce({
        content: JSON.stringify({
          scene: good,
          name: "Growth counter",
          images: [],
        }),
      });
    const reply = await designChecked({
      model: "test",
      system: "test",
      user: "Create a growth counter",
      quality: box,
      duration: 4,
      hasBrandLogo: false,
    });
    expect(JSON.parse(reply).scene.duration).toBe(4);
    expect(vi.mocked(callSceneModel).mock.calls[1][0].user).toContain(
      "exceeded the output budget",
    );
  });
  it("does not round transcript duration outside the validator tolerance", () => {
    const duration = 4.234567;
    const prompt = boxLines(
      { aspect: 1.6, widthPx: 280, heightPx: 175 },
      duration,
      {
        frameAspect: 9 / 16,
        frameHeightPx: 1080,
      },
    );
    const sent = Number(prompt.match(/Duration: ([\d.]+) seconds/)?.[1]);
    expect(Math.abs(sent - duration)).toBeLessThan(0.001);
  });
  it("honors a singular request without limiting broad creative requests", () => {
    expect(
      requestedMomentLimit("Create an animated overlay showing growth"),
    ).toBe(1);
    expect(requestedMomentLimit("Add one custom visual about signups")).toBe(1);
    expect(
      requestedMomentLimit("Create overlays wherever they help"),
    ).toBeGreaterThan(1);
  });
  it("accepts a readable animated composition", () => {
    expect(sceneQualityIssues(validateScene(good)!.scene, box)).toEqual([]);
  });
  it("does not silently enlarge the failed check-in layout", () => {
    const raw = {
      ...good,
      nodes: [
        {
          id: "old_label",
          type: "text",
          text: "EARLIER",
          x: 0.1,
          y: 0.16,
          width: 0.4,
          height: 0.08,
          size: 0.07,
        },
        {
          id: "old_users",
          type: "number",
          from: 324,
          to: 324,
          x: 0.1,
          y: 0.2,
          width: 0.28,
          height: 0.21,
          size: 0.155,
        },
        {
          id: "old_payments_label",
          type: "text",
          text: "successful payments",
          x: 0.29,
          y: 0.335,
          width: 0.42,
          height: 0.1,
          size: 0.08,
        },
      ],
      animations: [],
    };
    const scene = validateScene(raw, {
      frameHeightPx: 1080,
      boxHeightPx: 180,
    })!.scene;
    expect(scene.nodes[0]).toHaveProperty("size", 0.07);
    expect(
      sceneQualityIssues(scene, { ...box, requireMotion: true }).join(" "),
    ).toMatch(/minimum/);
    expect(sceneQualityIssues(scene, box).join(" ")).toMatch(/overlap|height/);
  });
  it("allows sequential text in the same location", () => {
    const scene = validateScene({
      ...good,
      nodes: [
        { ...good.nodes[0], id: "first" },
        { ...good.nodes[0], id: "second" },
      ],
      animations: [
        {
          node: "first",
          property: "opacity",
          from: 1,
          to: 0,
          start: 1.8,
          end: 2,
        },
        {
          node: "second",
          property: "opacity",
          from: 0,
          to: 1,
          start: 2,
          end: 2.2,
        },
      ],
    })!.scene;
    expect(sceneQualityIssues(scene, box)).toEqual([]);
  });
  it("repairs failed drafts within one operation", async () => {
    vi.mocked(callSceneModel).mockReset();
    vi.mocked(callSceneModel)
      .mockResolvedValueOnce({
        content: JSON.stringify({ scene: { ...good, animations: [] } }),
      })
      .mockResolvedValueOnce({ content: JSON.stringify({ scene: good }) });
    const reply = await designChecked({
      model: "test",
      system: "design",
      user: "animate signups",
      quality: { ...box, requireMotion: true },
      duration: 4,
      hasBrandLogo: false,
    });
    expect(JSON.parse(reply).scene.animations).toHaveLength(1);
    expect(vi.mocked(callSceneModel).mock.calls[1][0].user).toContain(
      "failed layout preflight",
    );
  });
  it("fails closed after three unreadable drafts", async () => {
    vi.mocked(callSceneModel)
      .mockReset()
      .mockResolvedValue({
        content: JSON.stringify({ scene: { ...good, animations: [] } }),
      });
    await expect(
      designChecked({
        model: "test",
        system: "design",
        user: "animate signups",
        quality: { ...box, requireMotion: true },
        duration: 4,
        hasBrandLogo: false,
      }),
    ).rejects.toThrow("layout_quality_failed");
    expect(callSceneModel).toHaveBeenCalledTimes(3);
  });
});
