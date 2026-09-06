import { beforeEach, expect, it, vi } from "vitest";
const outbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http/outbound", async (original) => ({
  ...(await original<typeof import("@/lib/http/outbound")>()),
  fetchBoundedJson: outbound,
}));
import { callSceneModel } from "./scene-model-call";
beforeEach(() => {
  vi.stubEnv("SURPLUS_API_KEY", "test");
  outbound.mockReset().mockResolvedValue({
    response: { ok: true },
    data: {
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
    },
  });
});
it("sends image evidence as multimodal content, not an ignored JSON field", async () => {
  await callSceneModel({
    model: "claude-opus-4.7",
    system: "Review",
    user: "At 3s",
    images: ["/9j/AA=="],
    maxCompletionTokens: 100,
    timeoutMs: 1000,
  });
  const body = JSON.parse(outbound.mock.calls[0][1].body);
  expect(body.messages[1].content).toEqual([
    { type: "text", text: "At 3s" },
    {
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,/9j/AA==", detail: "high" },
    },
  ]);
});
it.each(["gpt-5.4", "claude-opus-4.7"])(
  "sends compatible bounded requests for %s",
  async (model) => {
    await callSceneModel({
      model,
      system: "JSON only",
      user: "design",
      maxCompletionTokens: 8000,
      timeoutMs: 1000,
    });
    const body = JSON.parse(outbound.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(8000);
    expect(body.response_format).toEqual(
      model.startsWith("claude-") ? undefined : { type: "json_object" },
    );
    expect(outbound.mock.calls[0][2].maxBytes).toBe(2 * 1024 * 1024);
  },
);
it("rejects truncated scene replies", async () => {
  outbound.mockResolvedValue({
    response: { ok: true },
    data: {
      choices: [
        { message: { content: '{"partial":true}' }, finish_reason: "length" },
      ],
    },
  });
  await expect(
    callSceneModel({
      model: "gpt-5.4",
      system: "JSON",
      user: "design",
      maxCompletionTokens: 100,
      timeoutMs: 1000,
    }),
  ).rejects.toThrow("answer_truncated");
});
