import { beforeEach, expect, it, vi } from "vitest";
import { directChecked } from "./direct-checked";
import { paletteFor } from "./scene-colors";
import type { DirectInput } from "./direct-input";
const call = vi.hoisted(() => vi.fn());
vi.mock("./scene-model-call", () => ({ callSceneModel: call }));
const input: DirectInput = {
  instruction: "Add useful overlays",
  words: "Revenue is now $560 with $0 spent on ads"
    .split(" ")
    .map((text) => ({ text })),
  speaker: [],
  placed: [],
  texts: [],
};
const brand = { palette: paletteFor([]), hasKit: false, colors: [], logos: [] };
const moment = {
  quote: "Revenue is now $560",
  brief: "Show $560 revenue",
  name: "Revenue comparison",
  kind: "other",
};
const reply = (moments: unknown[]) => ({
  content: JSON.stringify({ moments }),
});
beforeEach(() => call.mockReset());
it("delivers only the reviewed facts, not a draft's invented starting value", async () => {
  call
    .mockResolvedValueOnce(reply([{ ...moment, brief: "Revenue $0 → $560" }]))
    .mockResolvedValueOnce(reply([moment]));
  const result = await directChecked(input, brand, "review-model");
  expect(result.moments[0].brief).toBe(moment.brief);
  expect(call).toHaveBeenCalledTimes(2);
  expect(call.mock.calls[1][0].user).toContain("Revenue $0 → $560");
  expect(call.mock.calls[1][0].system).toContain(
    "Zero ad spend does NOT imply zero previous revenue",
  );
});
it("allows the reviewer to remove every weak visual without replacements", async () => {
  call.mockResolvedValueOnce(reply([moment])).mockResolvedValueOnce(reply([]));
  expect((await directChecked(input, brand, "model")).moments).toEqual([]);
});
it("does not spend another call when the editor chooses no overlays", async () => {
  call.mockResolvedValueOnce(reply([]));
  expect((await directChecked(input, brand, "model")).moments).toEqual([]);
  expect(call).toHaveBeenCalledTimes(1);
});
it("rejects a malformed review rather than falling back to an unreviewed draft", async () => {
  call
    .mockResolvedValueOnce(reply([moment]))
    .mockResolvedValueOnce({ content: "{}" });
  await expect(directChecked(input, brand, "model")).rejects.toThrow(
    "invalid_reply",
  );
});
it("rejects invented placement quotes", async () => {
  call
    .mockResolvedValueOnce(reply([moment]))
    .mockResolvedValueOnce(reply([{ ...moment, quote: "We started at zero" }]));
  await expect(directChecked(input, brand, "model")).rejects.toThrow(
    "invalid_quote",
  );
});
it("restores transcript punctuation and case without changing the spoken words", async () => {
  call.mockResolvedValue(reply([{ ...moment, quote: "revenue is now 560" }]));
  expect((await directChecked(input, brand, "model")).moments[0].quote).toBe(
    "Revenue is now $560",
  );
});
it("passes cancellation to both calls", async () => {
  const { signal } = new AbortController();
  call.mockResolvedValue(reply([moment]));
  await directChecked(input, brand, "model", signal);
  for (const [request] of call.mock.calls) expect(request.signal).toBe(signal);
});
