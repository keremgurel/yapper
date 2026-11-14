import { beforeEach, expect, it, vi } from "vitest";
import { designChecked } from "./design-checked";
import { directChecked } from "./direct-checked";
import { SCENE_BUDGETS } from "./scene-budgets";
import { paletteFor } from "./scene-colors";

const call = vi.hoisted(() => vi.fn());
vi.mock("./scene-model-call", () => ({ callSceneModel: call }));
beforeEach(() => call.mockReset());

// Thinking counts against the cap. Opus spent 7,770 to 8,000 tokens of an
// 8,000 design budget thinking, so the caps must leave room for that.
it("gives every pass room to think before it answers", () => {
  expect(SCENE_BUDGETS.design.maxCompletionTokens).toBeGreaterThanOrEqual(
    16_000,
  );
  expect(SCENE_BUDGETS.direct.maxCompletionTokens).toBeGreaterThanOrEqual(
    10_000,
  );
  expect(SCENE_BUDGETS.renderReview.maxCompletionTokens).toBeGreaterThanOrEqual(
    6_000,
  );
  expect(SCENE_BUDGETS.revisionPlan.maxCompletionTokens).toBeGreaterThanOrEqual(
    6_000,
  );
});

it("sends the design budget, and asks a cut-off design to decide sooner", async () => {
  call
    .mockRejectedValueOnce(new Error("answer_truncated"))
    .mockRejectedValueOnce(new Error("answer_truncated"))
    .mockRejectedValueOnce(new Error("answer_truncated"));
  await expect(
    designChecked({
      model: "claude-opus-4.7",
      system: "design",
      user: "a stopwatch",
      quality: { widthPx: 500, heightPx: 500, frameHeightPx: 1080 },
      duration: 3,
      hasBrandLogo: false,
    }),
  ).rejects.toThrow("answer_truncated");
  expect(call).toHaveBeenCalledTimes(3);
  for (const [request] of call.mock.calls)
    expect(request.maxCompletionTokens).toBe(
      SCENE_BUDGETS.design.maxCompletionTokens,
    );
  expect(call.mock.calls[1][0].user).toContain("Settle on the design quickly");
});

it("sends the direct budget to the draft and to its review", async () => {
  const moment = {
    quote: "Revenue is now $560",
    brief: "Show $560 revenue",
    name: "Revenue",
    kind: "other",
  };
  const reply = { content: JSON.stringify({ moments: [moment] }) };
  call.mockResolvedValueOnce(reply).mockResolvedValueOnce(reply);
  await directChecked(
    {
      instruction: "Add overlays",
      words: "Revenue is now $560 today".split(" ").map((text) => ({ text })),
      speaker: [],
      placed: [],
      texts: [],
    },
    { palette: paletteFor([]), hasKit: false, colors: [], logos: [] },
    "claude-opus-4.7",
  );
  expect(
    call.mock.calls.map(([request]) => request.maxCompletionTokens),
  ).toEqual([
    SCENE_BUDGETS.direct.maxCompletionTokens,
    SCENE_BUDGETS.direct.maxCompletionTokens,
  ]);
});
