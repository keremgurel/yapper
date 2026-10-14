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
