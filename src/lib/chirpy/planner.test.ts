import { expect, it, vi } from "vitest";
import { planChirpy } from "./planner";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import type { PlanInput } from "./protocol";
vi.mock("@/lib/studio/scene/scene-model-call", () => ({
  callSceneModel: vi.fn(),
}));
it("sends the selected overlay image as vision input without duplicating base64 in text", async () => {
  vi.mocked(callSceneModel).mockResolvedValue({
    content: '{"message":"Which section?","actions":[]}',
  });
  const input: PlanInput = {
    protocolVersion: 1,
    executionID: "33333333-3333-4333-8333-333333333333",
    projectID: "11111111-1111-4111-8111-111111111111",
    sessionID: "22222222-2222-4222-8222-222222222222",
    revision: 1,
    context: {
      selectedOverlayImage: { overlayID: "overlay", jpeg: "/9j/AA==" },
    },
    catalog: [{ id: "editor.overlays.zoom" }],
    messages: [{ role: "user", content: "Zoom into this" }],
  };
  await planChirpy(input);
  const request = vi.mocked(callSceneModel).mock.calls[0][0];
  expect(request.images).toEqual(["/9j/AA=="]);
  expect(request.user).not.toContain("/9j/AA==");
  expect(request.user).toContain("editor.overlays.zoom");
});

const bulkInput: PlanInput = {
  protocolVersion: 1,
  executionID: "33333333-3333-4333-8333-333333333333",
  projectID: "11111111-1111-4111-8111-111111111111",
  sessionID: "22222222-2222-4222-8222-222222222222",
  revision: 2,
  context: { overlays: [] },
  catalog: [{ id: "editor.overlays.setFrame" }],
  messages: [{ role: "user", content: "make all overlays full screen please" }],
};
const fullFrameReply = {
  message: "Make every overlay full frame.",
  actions: [
    {
      action: "editor.overlays.setFrame",
      arguments: { overlayIDs: [], all: true, fit: "full" },
    },
  ],
};

it("repairs an unsupported action without executing or exposing it", async () => {
  vi.mocked(callSceneModel).mockClear();
  vi.mocked(callSceneModel)
    .mockResolvedValueOnce({
      content: JSON.stringify({
        message: "",
        actions: [{ action: "invented", arguments: {} }],
      }),
    })
    .mockResolvedValueOnce({ content: JSON.stringify(fullFrameReply) });
  expect(await planChirpy(bulkInput)).toEqual(fullFrameReply);
  const calls = vi.mocked(callSceneModel).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[1][0].user).toContain("not in this client's catalog");
  expect(calls[1][0].user).not.toContain("invented");
  expect(calls[1][0].timeoutMs).toBeLessThanOrEqual(calls[0][0].timeoutMs);
});

it("fails closed after one unsuccessful repair", async () => {
  vi.mocked(callSceneModel).mockClear();
  vi.mocked(callSceneModel).mockResolvedValue({
    content: JSON.stringify({
      ...fullFrameReply,
      actions: [
        {
          action: "editor.overlays.setFrame",
          arguments: { overlayIDs: [], all: true, fit: "full screen" },
        },
      ],
    }),
  });
  await expect(planChirpy(bulkInput)).rejects.toThrow("invalid_action_plan");
  expect(callSceneModel).toHaveBeenCalledTimes(2);
  expect(vi.mocked(callSceneModel).mock.calls[1][0].user).toContain(
    "Arguments for editor.overlays.setFrame",
  );
});

it("does not retry provider failures as a schema repair", async () => {
  vi.mocked(callSceneModel).mockClear();
  vi.mocked(callSceneModel).mockRejectedValue(new Error("timeout"));
  await expect(planChirpy(bulkInput)).rejects.toThrow("timeout");
  expect(callSceneModel).toHaveBeenCalledTimes(1);
});
