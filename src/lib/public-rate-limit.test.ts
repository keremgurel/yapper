import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  rateLimitErrorResponse: vi.fn(),
  rateLimitClientIdentity: vi.fn(),
  rateLimitSubject: vi.fn(),
}));

vi.mock("@/lib/db/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/rate-limit")>();
  return {
    ...actual,
    consumeRateLimit: mocks.consumeRateLimit,
    rateLimitErrorResponse: mocks.rateLimitErrorResponse,
    rateLimitSubject: mocks.rateLimitSubject,
  };
});
vi.mock("@/lib/rate-limit/identity", () => ({
  rateLimitClientIdentity: mocks.rateLimitClientIdentity,
}));
vi.mock("@/lib/rate-limit/telemetry", () => ({
  recordRateLimitTelemetry: vi.fn(),
}));

import { RateLimitUnavailableError } from "@/lib/db/rate-limit";
import { guardWaitlistEmail, guardWaitlistIp } from "./public-rate-limit";

const allowed = {
  allowed: true,
  scope: "waitlist:ip",
  limit: 2,
  remaining: 1,
  resetAt: new Date("2026-08-13T00:00:00Z"),
  retryAfterSeconds: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimitClientIdentity.mockReturnValue({
    subject: "trusted_ip_hash",
    source: "vercel",
  });
  mocks.rateLimitSubject.mockReturnValue("email_hash");
  mocks.consumeRateLimit.mockResolvedValue(allowed);
  mocks.rateLimitErrorResponse.mockImplementation((value) =>
    Response.json(
      {
        error:
          value instanceof RateLimitUnavailableError
            ? "rate_limit_unavailable"
            : "rate_limited",
      },
      { status: value instanceof RateLimitUnavailableError ? 503 : 429 },
    ),
  );
});

describe("public rate-limit guards", () => {
  it("uses the canonical trusted-IP subject and waitlist IP policy", async () => {
    const request = new Request("https://ypr.app/api/waitlist", {
      headers: { "x-vercel-forwarded-for": "192.0.2.1" },
    });

    await expect(guardWaitlistIp(request)).resolves.toBeNull();
    expect(mocks.rateLimitClientIdentity).toHaveBeenCalledWith(request);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      "trusted_ip_hash",
      expect.objectContaining({ scope: "waitlist:ip", capacity: 2 }),
    );
  });

  it("domain-separates the normalized email subject", async () => {
    await expect(guardWaitlistEmail("person@example.com")).resolves.toBeNull();
    expect(mocks.rateLimitSubject).toHaveBeenCalledWith(
      "email",
      "person@example.com",
    );
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      "email_hash",
      expect.objectContaining({ scope: "waitlist:email", capacity: 1 }),
    );
  });

  it("returns the standardized denial response", async () => {
    const denied = { ...allowed, allowed: false, retryAfterSeconds: 60 };
    mocks.consumeRateLimit.mockResolvedValue(denied);

    await expect(
      guardWaitlistIp(new Request("https://ypr.app/api/waitlist")),
    ).resolves.toHaveProperty("status", 429);
    expect(mocks.rateLimitErrorResponse).toHaveBeenCalledWith(denied);
  });

  it.each(["identity", "database"])(
    "fails closed with a standardized 503 on %s failure",
    async (failure) => {
      if (failure === "identity") {
        mocks.rateLimitClientIdentity.mockImplementation(() => {
          throw new Error("bad_identity_config");
        });
      } else {
        mocks.consumeRateLimit.mockRejectedValue(new Error("database_down"));
      }

      await expect(
        guardWaitlistIp(new Request("https://ypr.app/api/waitlist")),
      ).resolves.toHaveProperty("status", 503);
      expect(mocks.rateLimitErrorResponse).toHaveBeenCalledWith(
        expect.any(RateLimitUnavailableError),
      );
    },
  );
});
