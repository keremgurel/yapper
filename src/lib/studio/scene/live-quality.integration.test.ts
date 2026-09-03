import { it, expect, vi } from "vitest";
import { loadLiveEnv } from "./live-env";
import { mkdir, writeFile } from "node:fs/promises";
import { designMoments } from "./design-moments";
import { paletteFor } from "./scene-colors";
import * as provider from "./scene-model-call";
import { generateSceneImage } from "./generate-scene-image";

it.skipIf(process.env.RUN_OVERLAY_IMAGE_EVAL !== "1")(
  "generates an actual overlay illustration",
  async () => {
    loadLiveEnv();
    const out = process.env.OVERLAY_EVAL_OUTPUT!;
    expect(out).toBeTruthy();
    const result = await generateSceneImage({
      prompt:
        "A small stack of reusable creative cards, orange and charcoal accents on white, clean editorial illustration, no writing.",
      aspect: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.data.length).toBeGreaterThan(1000);
    await mkdir(out, { recursive: true });
    const extension = result!.mimeType.split("/")[1];
    await writeFile(
      `${out}/illustration.${extension}`,
      Buffer.from(result!.data, "base64"),
    );
  },
  140_000,
);

// Opt-in, paid provider QA. Writes only to a scratch directory, never a project.
it.skipIf(process.env.RUN_OVERLAY_LIVE_EVAL !== "1")(
  "generates real layout-checked motion",
  async () => {
    loadLiveEnv();
    const out = process.env.OVERLAY_EVAL_OUTPUT!;
    expect(out).toBeTruthy();
    await mkdir(out, { recursive: true });
    const original = provider.callSceneModel;
    let draft = 0;
    vi.spyOn(provider, "callSceneModel").mockImplementation(async (call) => {
      const result = await original(call);
      await writeFile(
        `${out}/draft-${draft++}.json`,
        JSON.stringify(
          { user: call.user, reply: JSON.parse(result.content) },
          null,
          2,
        ),
      );
      return result;
    });
    const result = await designMoments({
      model: process.env.AI_OVERLAY_MODEL ?? "claude-opus-4.7",
      instruction:
        "Create an animated overlay showing the growth from our last check-in to now.",
      frameAspect: 9 / 16,
      frameHeightPx: 1080,
      brand: { palette: paletteFor([]), hasKit: false, logos: [], colors: [] },
      moments: [
        {
          id: "growth",
          brief:
            "Show signup growth from 324 to 553. Payments also rose from 17 to 28; prioritize signup growth if the small box cannot clearly hold both. Make the change feel tangible through animation.",
          name: "Signup growth",
          description: "An animated comparison of signup growth",
          kind: "counter",
          wantsImage: false,
          quote:
            "we were at 324 users and 17 successful payments. Now we're at 553 sign ups and 28 successful payments.",
          sentence: "",
          duration: 7.7,
          box: { widthPx: 254, heightPx: 160, aspect: 254 / 160 },
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
  },
  240_000,
);
