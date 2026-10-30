import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  auth: vi.fn(),
  capture: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: mocks.capture,
}));
import { settleProviderBudget } from "./provider-budget";
import { recordProviderResponse } from "./provider-usage";
import { runWithAiUsage } from "./ai-usage-scope";

const reservation = {
  microusd: 1_400_000,
  at: new Date("2026-10-30T12:00:00Z"),
};
const chatReply = (overrides: Record<string, unknown> = {}) => ({
  input: "https://api.surplusintelligence.ai/v1/chat/completions",
  init: { method: "POST", body: JSON.stringify({ model: "gpt-5.4" }) },
  reservation,
  status: 200,
  bytes: new TextEncoder().encode(
    JSON.stringify({
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 100,
        prompt_tokens_details: { cached_tokens: 0 },
        buyer_cost_micro: 30,
      },
    }),
  ),
  latencyMs: 812.4,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.after.mockImplementation(() => {
    throw new Error("outside a request scope");
  });
  mocks.auth.mockResolvedValue({ userId: "user_a" });
});

it("settles the reservation to list cost and records the call in the action's scope", async () => {
  const calls = await runWithAiUsage("chirpy_plan_created", async (scope) => {
    await recordProviderResponse(chatReply());
    return scope.calls;
  });
  // 1000 x 2.5 + 100 x 15
  expect(settleProviderBudget).toHaveBeenCalledWith(reservation, 4000);
  expect(calls).toEqual([
    expect.objectContaining({
      model: "gpt-5.4",
      provider: "api.surplusintelligence.ai",
      inputTokens: 1000,
      outputTokens: 100,
      listCostMicrousd: 4000,
      buyerCostMicrousd: 30,
      latencyMs: 812,
    }),
  ]);
  expect(mocks.capture).not.toHaveBeenCalled();
});

it("reports a call outside any action on its own, with the signed-in user", async () => {
  await recordProviderResponse(chatReply());
  await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledOnce());
  expect(mocks.capture).toHaveBeenCalledWith(
    "user_a",
    "$ai_generation",
    expect.objectContaining({
      action: "unattributed",
      $ai_model: "gpt-5.4",
      $ai_total_cost_usd: 0.004,
      ai_buyer_cost_microusd: 30,
    }),
  );
});

it("reports background calls made after the action reported, under its identity", async () => {
  await runWithAiUsage("idea_created", async (scope) => {
    scope.reported = true;
    scope.distinctId = "user_b";
    scope.properties = { surface: "macos" };
    await recordProviderResponse(chatReply());
  });
  await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledOnce());
  expect(mocks.capture).toHaveBeenCalledWith(
    "user_b",
    "$ai_generation",
    expect.objectContaining({ action: "idea_created", surface: "macos" }),
  );
  expect(mocks.auth).not.toHaveBeenCalled();
});

it("leaves failed, non-chat and usage-less replies at their full reservation", async () => {
  await recordProviderResponse(chatReply({ status: 502 }));
  await recordProviderResponse(
    chatReply({ input: "https://api.deepgram.com/v1/listen" }),
  );
  await recordProviderResponse(
    chatReply({ bytes: new TextEncoder().encode("{}") }),
  );
  expect(settleProviderBudget).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
});

it("never fails the product request when accounting breaks", async () => {
  vi.mocked(settleProviderBudget).mockRejectedValueOnce(new Error("db down"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await expect(recordProviderResponse(chatReply())).resolves.toBeUndefined();
});
