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
