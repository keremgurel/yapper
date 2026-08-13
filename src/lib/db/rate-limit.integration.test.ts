import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  cleanupExpiredRateLimitBuckets,
  consumeRateLimit,
  consumeRateLimits,
  type RateLimitPolicy,
} from "./rate-limit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const inspectionPool = new Pool({ connectionString, max: 4 });
const testPrefix = `integration:${randomUUID()}`;

function subject(): string {
  return randomUUID().replaceAll("-", "").padEnd(64, "0");
}

function policy(scope: string, capacity: number): RateLimitPolicy {
  return {
    scope: `${testPrefix}:${scope}`,
    capacity,
    // Effectively disable refill during a millisecond-scale concurrency test.
    refillPerSecond: 1e-9,
    idleTtlSeconds: 3_600,
  };
}

async function bucket(scope: string, subjectHash: string) {
  const result = await inspectionPool.query<{
    tokens: number;
    expires_at: Date;
  }>(
    `select tokens, expires_at
       from rate_limit_buckets
      where scope = $1 and subject_hash = $2`,
    [scope, subjectHash],
  );
  return result.rows[0];
}

beforeAll(async () => {
  await inspectionPool.query("select 1 from rate_limit_buckets limit 0");
});

afterAll(async () => {
  await inspectionPool.query(
    "delete from rate_limit_buckets where scope like $1",
    [`${testPrefix}:%`],
  );
  await inspectionPool.end();
});

describe.sequential("PostgreSQL rate-limit protocol", () => {
  it("admits exactly capacity concurrent requests on first use", async () => {
    const actor = subject();
    const rule = policy("first-use", 7);
    const decisions = await Promise.all(
      Array.from({ length: 24 }, () => consumeRateLimit(actor, rule)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(7);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(17);
    expect(
      Number((await bucket(rule.scope, actor)).tokens),
    ).toBeGreaterThanOrEqual(0);
  });

  it("serializes concurrent consumption of an existing partial bucket", async () => {
    const actor = subject();
    const rule = policy("existing", 5);
    await inspectionPool.query(
      `insert into rate_limit_buckets
        (scope, subject_hash, tokens, capacity, refill_per_second, updated_at, expires_at)
       values ($1, $2, 3, 5, $3, clock_timestamp(), clock_timestamp() + interval '1 hour')`,
      [rule.scope, actor, rule.refillPerSecond],
    );

    const decisions = await Promise.all(
      Array.from({ length: 12 }, () => consumeRateLimit(actor, rule)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(9);
  });

  it("rolls back an earlier bucket when a later policy denies", async () => {
    const actor = subject();
    const earlier = policy("a-earlier", 2);
    const later = policy("z-later", 1);
    await inspectionPool.query(
      `insert into rate_limit_buckets
        (scope, subject_hash, tokens, capacity, refill_per_second, updated_at, expires_at)
       values ($1, $2, 0, 1, $3, clock_timestamp(), clock_timestamp() + interval '1 hour')`,
      [later.scope, actor, later.refillPerSecond],
    );

    const [decision] = await consumeRateLimits([
      { subjectHash: actor, policy: earlier },
      { subjectHash: actor, policy: later },
    ]);

    expect(decision.allowed).toBe(false);
    expect(decision.scope).toBe(later.scope);
    expect(await bucket(earlier.scope, actor)).toBeUndefined();
    expect(Number((await bucket(later.scope, actor)).tokens)).toBe(0);
  });

  it("does not lose or over-admit a bucket racing expiry cleanup", async () => {
    const actor = subject();
    const rule: RateLimitPolicy = {
      ...policy("cleanup-race", 1),
      refillPerSecond: 1,
    };
    await inspectionPool.query(
      `insert into rate_limit_buckets
        (scope, subject_hash, tokens, capacity, refill_per_second, updated_at, expires_at)
       values ($1, $2, 0, 1, 1, clock_timestamp() - interval '2 seconds',
               clock_timestamp() - interval '1 second')`,
      [rule.scope, actor],
    );

    const [decision] = await Promise.all([
      consumeRateLimit(actor, rule),
      cleanupExpiredRateLimitBuckets(1_000),
    ]);

    expect(decision.allowed).toBe(true);
    const persisted = await bucket(rule.scope, actor);
    expect(persisted).toBeDefined();
    expect(persisted.expires_at.getTime()).toBeGreaterThan(Date.now());
    await expect(consumeRateLimit(actor, rule)).resolves.toMatchObject({
      allowed: false,
    });
  });
});
