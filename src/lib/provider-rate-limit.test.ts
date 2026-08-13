import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimits: vi.fn(),
  consumeRateLimit: vi.fn(),
  rateLimitErrorResponse: vi.fn(),
  rateLimitClientIdentity: vi.fn(),
  rateLimitUserSubject: vi.fn(),
}));

vi.mock("@/lib/db/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/rate-limit")>();
  return {
    ...actual,
    consumeRateLimits: mocks.consumeRateLimits,
    consumeRateLimit: mocks.consumeRateLimit,
    rateLimitErrorResponse: mocks.rateLimitErrorResponse,
    rateLimitUserSubject: mocks.rateLimitUserSubject,
  };
});
vi.mock("@/lib/rate-limit/identity", () => ({
  rateLimitClientIdentity: mocks.rateLimitClientIdentity,
}));
vi.mock("@/lib/rate-limit/telemetry", () => ({
  recordRateLimitTelemetry: vi.fn(),
}));

import { RateLimitUnavailableError } from "@/lib/db/rate-limit";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "./provider-rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimitUserSubject.mockReturnValue("subject_hash");
  mocks.rateLimitClientIdentity.mockReturnValue({
    subject: "ip_subject_hash",
    source: "vercel",
  });
  mocks.consumeRateLimit.mockResolvedValue({ allowed: true });
  mocks.rateLimitErrorResponse.mockReturnValue(
    Response.json({ error: "limited" }, { status: 429 }),
  );
});

describe("guardProviderSpend", () => {
  it("uses a separate high-ceiling IP ingress bucket", async () => {
    const request = new Request("https://ypr.app/api/feedback");

    await expect(guardProviderIngress(request)).resolves.toBeNull();
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      "ip_subject_hash",
      expect.objectContaining({
        scope: "ip:provider-ingress",
        capacity: 100,
      }),
    );
    expect(mocks.consumeRateLimits).not.toHaveBeenCalled();
  });

  it("atomically consumes shared and endpoint policy", async () => {
    mocks.consumeRateLimits.mockResolvedValue([
      { allowed: true, scope: "user:provider-spend" },
      { allowed: true, scope: "user:provider-spend:feedback" },
    ]);

    const request = new Request("https://ypr.app/api/feedback");
    await expect(
      guardProviderSpend(request, "user_test", "feedback"),
    ).resolves.toBeNull();
    expect(mocks.consumeRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        subjectHash: "subject_hash",
        policy: expect.objectContaining({ scope: "user:provider-spend" }),
      }),
      expect.objectContaining({
        subjectHash: "subject_hash",
        policy: expect.objectContaining({
          scope: "user:provider-spend:feedback",
        }),
      }),
      expect.objectContaining({
        subjectHash: "ip_subject_hash",
        policy: expect.objectContaining({
          scope: "ip:provider-spend",
          capacity: 120,
        }),
      }),
    ]);
  });

  it("returns a standardized denial without provider work", async () => {
    const denied = { allowed: false, scope: "user:provider-spend" };
    mocks.consumeRateLimits.mockResolvedValue([denied]);

    await expect(
      guardProviderSpend(
        new Request("https://ypr.app/api/feedback"),
        "user_test",
        "feedback",
      ),
    ).resolves.toHaveProperty("status", 429);
    expect(mocks.rateLimitErrorResponse).toHaveBeenCalledWith(denied);
  });

  it("fails closed when identity or storage is unavailable", async () => {
    mocks.consumeRateLimits.mockRejectedValue(new Error("database_down"));

    await guardProviderSpend(
      new Request("https://ypr.app/api/feedback"),
      "user_test",
      "feedback",
    );
    expect(mocks.rateLimitErrorResponse).toHaveBeenCalledWith(
      expect.any(RateLimitUnavailableError),
    );
  });
});
