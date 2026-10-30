import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  after: vi.fn(),
  capture: vi.fn(),
  captureImmediate: vi.fn(),
  flush: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({
    capture: mocks.capture,
    captureImmediate: mocks.captureImmediate,
    flush: mocks.flush,
  }),
}));
import {
  captureServerEvent,
  captureVerifiedEvent,
  withProductAnalytics,
} from "./server";
import { recordProviderResponse } from "@/lib/costs/provider-usage";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.auth.mockResolvedValue({ userId: "user_a" });
  mocks.flush.mockResolvedValue(undefined);
});
it("reports the server outcome after response without collecting request content", async () => {
  const response = Response.json({ secret: "private" }, { status: 201 });
  const tracked = withProductAnalytics("idea_created", async () => response);
  expect(
    await tracked(
      new Request("https://ypr.app/api/ideas", {
        method: "POST",
        body: "private idea",
        headers: {
          "user-agent": "YapperStudioNative/0.9.25",
          "x-yapper-build": "39",
        },
      }),
    ),
  ).toBe(response);
  expect(mocks.capture).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.capture).toHaveBeenCalledWith(
    expect.objectContaining({
      distinctId: "user_a",
      event: "product_action_completed",
      properties: expect.objectContaining({
        surface: "macos",
        action: "idea_created",
        status: 201,
        app_build: "39",
      }),
    }),
  );
  expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain("private");
});
it("records failed responses and excludes native development traffic", async () => {
  await withProductAnalytics(
    "script_generated",
    async () => new Response(null, { status: 402 }),
  )(
    new Request("https://ypr.app/api/generate/script", {
      headers: { "x-yapper-environment": "development" },
    }),
  );
  await mocks.after.mock.calls[0][0]();
  expect(mocks.capture.mock.calls[0][0]).toMatchObject({
    event: "product_action_failed",
    properties: { status: 402, environment: "development" },
  });
});
it("preserves product failures and successful responses when analytics is unavailable", async () => {
  mocks.auth.mockRejectedValue(new Error("auth unavailable"));
  const failure = new Error("original failure");
  await expect(
    withProductAnalytics("idea_created", async () => {
      throw failure;
    })(new Request("https://ypr.app")),
  ).rejects.toBe(failure);
  expect(
    (
      await withProductAnalytics(
        "idea_created",
        async () => new Response("ok"),
      )(new Request("https://ypr.app"))
    ).status,
  ).toBe(200);
});
it("delivery errors never break webhook processing; signup identity stays deterministic", async () => {
  mocks.flush.mockRejectedValue(new Error("network"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const timestamp = new Date("2026-10-15T00:00:00Z");
  await expect(
    captureServerEvent(
      "user_a",
      "signup_verified",
      { $insert_id: "clerk-signup:user_a" },
      timestamp,
    ),
  ).resolves.toBeUndefined();
  expect(mocks.capture.mock.calls[0][0]).toMatchObject({
    timestamp,
    properties: { $insert_id: "clerk-signup:user_a" },
  });
  warn.mockRestore();
});

it("authoritative webhook delivery rejects on ingestion failure so the sender retries", async () => {
  mocks.captureImmediate.mockRejectedValue(new Error("ingestion unavailable"));
  await expect(
    captureVerifiedEvent("user_a", "signup_verified", {
      $insert_id: "clerk-signup:user_a",
    }),
  ).rejects.toThrow("ingestion unavailable");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  await expect(
    captureVerifiedEvent("user_a", "signup_verified", {}),
  ).rejects.toThrow("not configured");
});

it("attributes the action's model calls and adds their cost to the action event", async () => {
  const chat = (model: string, usage: Record<string, unknown>) =>
    recordProviderResponse({
      input: "https://api.surplusintelligence.ai/v1/chat/completions",
      init: { method: "POST", body: JSON.stringify({ model }) },
      reservation: { microusd: 1_000_000, at: new Date() },
      status: 200,
      bytes: new TextEncoder().encode(JSON.stringify({ usage })),
      latencyMs: 500,
    });
  await withProductAnalytics("chirpy_plan_created", async () => {
    await chat("gpt-5.4", {
      prompt_tokens: 1000,
      completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 800 },
      buyer_cost_micro: 9,
    });
    await chat("gpt-5.4-mini", { prompt_tokens: 200, completion_tokens: 20 });
    return Response.json({});
  })(new Request("https://ypr.app/api/chirpy/plan", { method: "POST" }));
  await mocks.after.mock.calls[0][0]();
  const events = mocks.capture.mock.calls.map(([event]) => event);
  expect(
    events.filter((event) => event.event === "$ai_generation"),
  ).toHaveLength(2);
  expect(
    events.find((event) => event.event === "product_action_completed")
      ?.properties,
  ).toMatchObject({
    action: "chirpy_plan_created",
    ai_calls: 2,
    ai_input_tokens: 1200,
    ai_cached_input_tokens: 800,
    ai_output_tokens: 120,
    // gpt-5.4: 200 x 2.5 + 800 x 0.25 + 100 x 15; mini: 200 x 0.75 + 20 x 4.5
    ai_list_cost_microusd: 2200 + 240,
    // The mini reply did not report a settled cost.
    ai_buyer_cost_microusd: null,
  });
});
