import { beforeEach, expect, it, vi } from "vitest";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import type { PlanInput } from "../protocol";
import { planWithReads } from "./read-loop";
vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
}));

const OVERLAY = "55555555-5555-4555-8555-555555555555";
const input: PlanInput = {
  protocolVersion: 1,
  executionID: "33333333-3333-4333-8333-333333333333",
  projectID: "11111111-1111-4111-8111-111111111111",
  sessionID: "22222222-2222-4222-8222-222222222222",
  revision: 1,
  context: {
    selectedOverlayID: OVERLAY,
    selectedOverlayImage: { overlayID: OVERLAY, jpeg: "/9j/AA==" },
    overlays: [],
    // Long enough to be withheld: sections under 600 bytes always go inline.
    transcript: [
      {
        mediaID: "A",
        text: Array.from({ length: 150 }, (_, i) =>
          i === 1 ? "1:there" : i === 2 ? "2:friends" : `${i}:word`,
        ).join(" "),
      },
    ],
  },
  catalog: [{ id: "editor.overlays.setFrame" }],
  messages: [{ role: "user", content: "make all overlays full screen" }],
};
const plan = {
  message: "Full frame.",
  actions: [
    {
      action: "editor.overlays.setFrame",
      arguments: { overlayIDs: [], all: true, fit: "full" },
    },
  ],
};
const toolCall = (id: string, name: string, args: unknown) => ({
  id,
  type: "function" as const,
  function: { name, arguments: JSON.stringify(args) },
});
const calls = () =>
  vi.mocked(callSceneModel).mock.calls.map(([request]) => request);

beforeEach(() => {
  vi.mocked(callSceneModel).mockReset();
  vi.stubEnv("CHIRPY_INLINE_BYTES", "0");
});

it("answers tool calls from the uploaded context, then returns the plan", async () => {
  vi.mocked(callSceneModel)
    .mockResolvedValueOnce({
      content: "",
      toolCalls: [toolCall("t1", "read_transcript", { phrase: "there" })],
    })
    .mockResolvedValueOnce({ content: JSON.stringify(plan) });
  expect(await planWithReads(input)).toEqual(plan);
  const [first, second] = calls();
  expect(first.tools?.map((tool) => tool.function.name)).toEqual([
    "read_section",
    "read_transcript",
    "view_overlay_image",
  ]);
  // Withheld at a zero budget, and never sent as prompt text.
  expect(first.user).not.toContain("friends");
  expect(first.user).not.toContain("/9j/AA==");
  expect(first.images).toBeUndefined();
  expect(second.followUp?.[1]).toMatchObject({
    role: "tool",
    tool_call_id: "t1",
  });
  const result = second.followUp?.[1];
  expect(result?.role === "tool" && JSON.parse(result.content)).toMatchObject({
    found: 1,
    occurrences: [{ occurrence: 1, fromWord: 1, toWord: 1 }],
  });
  // The cached prefix is identical between the calls of a turn.
  expect(second.system).toBe(first.system);
  expect(second.reference).toBe(first.reference);
  expect(second.user).toBe(first.user);
});

it("attaches the overlay image only when the model asks for it", async () => {
  vi.mocked(callSceneModel)
    .mockResolvedValueOnce({
      content: "",
      toolCalls: [toolCall("t1", "view_overlay_image", {})],
    })
    .mockResolvedValueOnce({ content: JSON.stringify(plan) });
  await planWithReads(input);
  expect(calls()[1].followUp?.at(-1)).toMatchObject({
    role: "user",
    content: [
      { type: "text" },
      {
        type: "image_url",
        image_url: { url: "data:image/jpeg;base64,/9j/AA==" },
      },
    ],
  });
});

it("forces an answer on the last call", async () => {
  vi.mocked(callSceneModel).mockImplementation(async (request) =>
    request.toolChoice === "none"
      ? { content: JSON.stringify(plan) }
      : {
          content: "",
          toolCalls: [toolCall("t", "read_section", { section: "overlays" })],
        },
  );
  expect(await planWithReads(input)).toEqual(plan);
  expect(calls().map((request) => request.toolChoice)).toEqual([
    "auto",
    "auto",
    "auto",
    "none",
  ]);
});

it("repairs one invalid plan, then fails closed", async () => {
  vi.mocked(callSceneModel).mockResolvedValue({
    content: JSON.stringify({
      message: "",
      actions: [{ action: "invented", arguments: {} }],
    }),
  });
  await expect(planWithReads(input)).rejects.toThrow("invalid_action_plan");
  expect(calls()).toHaveLength(2);
  expect(JSON.stringify(calls()[1].followUp)).toContain(
    "not in this client's catalog",
  );
});
