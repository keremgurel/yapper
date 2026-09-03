import { it, expect } from "vitest";
import { loadLiveEnv } from "./live-env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { designMoments } from "./design-moments";
import { isMomentKind } from "./moment-kinds";
import { paletteFor } from "./scene-colors";

/**
 * Opt-in, paid review of one editorial proposal saved by an earlier run.
 *
 * `OVERLAY_EDITORIAL_FILE` points at an `editorial.json` with `input` and
 * `parsed` (what `/tmp/yapper-*-qa` runs write). The first moment is designed
 * for a box the native app would give a card of that aspect on a 9:16 frame,
 * and the scene lands in `OVERLAY_EVAL_OUTPUT/scene.json`, where the native
 * `SceneLayoutQualityTests` renders frames from it. Never touches a project.
 */
it.skipIf(
  process.env.RUN_OVERLAY_LIVE_EVAL !== "1" ||
    !process.env.OVERLAY_EDITORIAL_FILE,
)(
  "designs a saved editorial proposal for review",
  async () => {
    loadLiveEnv();
    const out = process.env.OVERLAY_EVAL_OUTPUT!;
    expect(out).toBeTruthy();
    const editorial = JSON.parse(
      await readFile(process.env.OVERLAY_EDITORIAL_FILE!, "utf8"),
    ) as {
      input: { instruction: string };
      parsed: {
        moments: {
          quote: string;
          brief: string;
          name: string;
          description: string;
          kind: string;
          wantsImage: boolean;
          aspect?: number;
        }[];
      };
    };
    const moment = editorial.parsed.moments[0];
    expect(moment).toBeTruthy();
    // A tall card beside the speaker on a 9:16 frame at 1080 high: about 70%
    // of the height, which is what the solver gives a card that has to clear
    // a centred face.
    const aspect = Math.min(5, Math.max(0.2, moment.aspect ?? 1.6));
    const heightPx = Math.round(
      aspect < 1 ? 720 : (1080 * 0.5625 * 0.86) / aspect,
    );
    const box = { heightPx, widthPx: Math.round(heightPx * aspect), aspect };
    const result = await designMoments({
      model: process.env.AI_OVERLAY_MODEL ?? "claude-opus-4.7",
      instruction: editorial.input.instruction,
      frameAspect: 9 / 16,
      frameHeightPx: 1080,
      brand: { palette: paletteFor([]), hasKit: false, logos: [], colors: [] },
      moments: [
        {
          id: "review",
          brief: moment.brief,
          name: moment.name,
          description: moment.description,
          kind: isMomentKind(moment.kind) ? moment.kind : "other",
          wantsImage: moment.wantsImage,
          quote: moment.quote,
          sentence: moment.quote,
          duration: 7.5,
          box,
        },
      ],
    });
    await mkdir(out, { recursive: true });
    await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
    expect(result.failed).toEqual([]);
    await writeFile(
      `${out}/scene.json`,
      JSON.stringify(result.scenes[0].scene, null, 2),
    );
    await writeFile(`${out}/box.json`, JSON.stringify(box));
  },
  300_000,
);
