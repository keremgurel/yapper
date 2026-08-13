import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  inserts: [] as Array<unknown[]>,
  deniedRows: [] as Array<unknown[]>,
  committed: 0,
  rolledBack: 0,
  transactionCalls: 0,
}));

function insertChain() {
  const chain = {
    values: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    returning: vi.fn(async () => harness.inserts.shift() ?? []),
  };
  return chain;
}

function selectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => harness.deniedRows.shift() ?? []),
  };
  return chain;
}

const tx = {
  insert: vi.fn(insertChain),
  select: vi.fn(selectChain),
};

const transaction = vi.fn(async (run: (value: typeof tx) => unknown) => {
  harness.transactionCalls += 1;
  try {
    const result = await run(tx);
    harness.committed += 1;
    return result;
  } catch (error) {
    harness.rolledBack += 1;
    throw error;
  }
});

vi.mock("./client", () => ({ getDb: () => ({ transaction }) }));

import {
  RateLimitUnavailableError,
  consumeRateLimit,
  consumeRateLimits,
  projectRateLimitBucket,
  rateLimitErrorResponse,
} from "./rate-limit";
import { rateLimitSubject } from "@/lib/rate-limit/identity";

const subject = "a".repeat(64);
const now = new Date("2026-08-13T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  harness.inserts.length = 0;
  harness.deniedRows.length = 0;
  harness.committed = 0;
  harness.rolledBack = 0;
  harness.transactionCalls = 0;
  process.env.RATE_LIMIT_SUBJECT_SECRET =
    "test-secret-with-at-least-32-bytes-long";
});

afterEach(() => {
  delete process.env.RATE_LIMIT_SUBJECT_SECRET;
});

describe("token bucket semantics", () => {
  it("spends sequentially, refills smoothly, and supports weighted cost", () => {
    const policy = { capacity: 5, refillPerSecond: 1, cost: 2 };
    const first = projectRateLimitBucket(5, 0, policy);
    const second = projectRateLimitBucket(first.tokens, 0, policy);
    const denied = projectRateLimitBucket(second.tokens, 0, policy);
    const refilled = projectRateLimitBucket(second.tokens, 1, policy);

    expect(first).toEqual({ allowed: true, tokens: 3, retryAfterSeconds: 0 });
    expect(second).toEqual({ allowed: true, tokens: 1, retryAfterSeconds: 0 });
    expect(denied).toEqual({ allowed: false, tokens: 1, retryAfterSeconds: 1 });
    expect(refilled).toEqual({
      allowed: true,
      tokens: 0,
      retryAfterSeconds: 0,
    });
  });

  it("caps refill at capacity", () => {
    expect(
      projectRateLimitBucket(1, 100, {
        capacity: 5,
        refillPerSecond: 1,
        cost: 1,
      }),
    ).toEqual({ allowed: true, tokens: 4, retryAfterSeconds: 0 });
  });
});

describe("distributed rate limit protocol", () => {
  it("returns a successful DB-clock decision", async () => {
    harness.inserts.push([{ tokens: 3, updatedAt: now }]);

    await expect(
      consumeRateLimit(subject, {
        scope: "user:spend:burst",
        capacity: 5,
        refillPerSecond: 1,
        cost: 2,
      }),
    ).resolves.toEqual({
      allowed: true,
      scope: "user:spend:burst",
      limit: 5,
      remaining: 3,
      resetAt: new Date("2026-08-13T12:00:02.000Z"),
      retryAfterSeconds: 0,
    });
    expect(harness.committed).toBe(1);
  });

  it("rolls back every earlier policy when a later policy denies", async () => {
    harness.inserts.push([{ tokens: 4, updatedAt: now }], []);
    harness.deniedRows.push([{ available: 0.25, databaseNow: now }]);

    const decisions = await consumeRateLimits([
      {
        subjectHash: "b".repeat(64),
        policy: { scope: "a:burst", capacity: 5, refillPerSecond: 1 },
      },
      {
        subjectHash: subject,
        policy: { scope: "b:daily", capacity: 100, refillPerSecond: 1 / 864 },
      },
    ]);

    expect(decisions).toEqual([
      expect.objectContaining({
        allowed: false,
        scope: "b:daily",
        remaining: 0,
        retryAfterSeconds: 648,
      }),
    ]);
    expect(harness.committed).toBe(0);
    expect(harness.rolledBack).toBe(1);
  });

  it.each([
    [{ scope: "", capacity: 1, refillPerSecond: 1 }],
    [{ scope: "valid", capacity: 0, refillPerSecond: 1 }],
    [{ scope: "valid", capacity: 1, refillPerSecond: 0 }],
    [{ scope: "valid", capacity: 1, refillPerSecond: 1, cost: 2 }],
  ])("rejects invalid policy before opening a transaction", async (policy) => {
    await expect(consumeRateLimit(subject, policy)).rejects.toThrow(
      "invalid_rate_limit_policy",
    );
    expect(harness.transactionCalls).toBe(0);
  });

  it("rejects duplicate scope/subject consumption before opening a transaction", async () => {
    const request = {
      subjectHash: subject,
      policy: { scope: "duplicate", capacity: 2, refillPerSecond: 1 },
    };
    await expect(consumeRateLimits([request, request])).rejects.toThrow(
      "duplicate_rate_limit_policy",
    );
    expect(harness.transactionCalls).toBe(0);
  });

  it("wraps database failures as an unavailable error", async () => {
    transaction.mockRejectedValueOnce(new Error("database offline"));
    await expect(
      consumeRateLimit(subject, {
        scope: "valid",
        capacity: 1,
        refillPerSecond: 1,
      }),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});

describe("subjects and HTTP responses", () => {
  it("domain-separates opaque HMAC subjects", () => {
    expect(rateLimitSubject("user", "same")).not.toBe(
      rateLimitSubject("email", "same"),
    );
    expect(rateLimitSubject("user", "same")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when the subject secret is missing", () => {
    delete process.env.RATE_LIMIT_SUBJECT_SECRET;
    expect(() => rateLimitSubject("user", "user_1")).toThrow(
      /at least 32 bytes/,
    );
  });

  it("builds a no-store 429 with standard retry metadata", async () => {
    const response = rateLimitErrorResponse({
      allowed: false,
      scope: "test",
      limit: 5,
      remaining: 0,
      resetAt: new Date("2026-08-13T12:00:07.000Z"),
      retryAfterSeconds: 7,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
    expect(response.headers.get("ratelimit-limit")).toBe("5");
    expect(response.headers.get("ratelimit-reset")).toBe("7");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "rate_limited",
      retryAfter: 7,
    });
  });

  it("builds a fail-closed no-store 503", () => {
    const response = rateLimitErrorResponse(new RateLimitUnavailableError());
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
