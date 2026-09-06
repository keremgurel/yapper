import { it, expect } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { planRevision, withOpeningHold } from "./revision-plan";
import { validateScene } from "./scene-validate";
it.skipIf(process.env.RUN_REVISION_EVAL !== "1").each([
  {
    name: "original-request",
    instruction:
      "for @Sign ups and payments counter update make the beginning where it stays on the we were at number longer so i can start it from earlier let it stay like that for 3 seconds and then finally turn into the new numbers",
    preservePlacement: false,
  },
  {
    name: "preserve-placement",
    instruction:
      "For @Sign ups and payments counter update, hold the old numbers for 3 seconds before animating to the new numbers. Keep its timeline placement unchanged.",
    preservePlacement: true,
  },
])(
  "interprets $name and retains a three-second old-value hold",
  async ({ name, instruction, preservePlacement }) => {
    const out = process.env.OVERLAY_EVAL_OUTPUT! + "/" + name;
    const project = JSON.parse(
      await readFile(process.env.OVERLAY_EVAL_PROJECT!, "utf8"),
    );
    const media = project.media.find(
      (m: { name: string }) =>
        m.name === "Sign ups and payments counter update",
    );
    const scene = JSON.parse(await readFile(new URL(media.url), "utf8"));
    const words = project.clips.flatMap(
      (c: { mediaID: string; sourceStart: number; sourceEnd: number }) =>
        project.transcript
          .filter(
            (w: { mediaID: string; start: number; end: number }) =>
              w.mediaID === c.mediaID &&
              (w.start + w.end) / 2 >= c.sourceStart &&
              (w.start + w.end) / 2 < c.sourceEnd,
          )
          .map((w: { text: string }) => ({ text: w.text })),
    );
    const plan = await planRevision(
      {
        op: "edit",
        instruction,
        asset: {
          name: media.name,
          description: media.generated.description,
          brief: media.generated.brief,
          quote: media.generated.quote,
          scene,
        },
        duration: scene.duration,
        box: {
          widthPx: media.width,
          heightPx: media.height,
          aspect: media.width / media.height,
        },
        frameAspect: 9 / 16,
        frameHeightPx: 1080,
        words,
      },
      "claude-opus-4.7",
    );
    await mkdir(out, { recursive: true });
    await writeFile(out + "/plan.json", JSON.stringify(plan, null, 2));
    expect(plan.openingHoldSeconds).toBe(3);
    // The original wording can reasonably request both. A move must locate
    // the earlier figures, never substitute for the three-second hold.
    if (plan.placementQuote) expect(plan.placementQuote).toContain("324");
    if (preservePlacement) expect(plan.placementQuote).toBeNull();
    expect(plan.timelineShiftSeconds).toBeNull();
    expect(plan.sceneInstruction).toBeNull();
    const updated = withOpeningHold(validateScene(scene)!.scene, 3);
    await writeFile(
      out + "/result.json",
      JSON.stringify({
        scenes: [
          {
            id: "revision",
            name: media.name,
            description: media.generated.description,
            scene: updated,
            images: [],
          },
        ],
      }),
    );
    expect(updated.duration).toBeCloseTo(6.5);
  },
  60000,
);
