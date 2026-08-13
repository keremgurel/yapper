import { and, asc, eq, lte, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import { rateLimitBuckets } from "./schema";

const MAX_SCOPE_LENGTH = 120;
const MAX_SUBJECT_LENGTH = 128;
const MAX_CAPACITY = 1_000_000;
const MAX_BATCH_SIZE = 1_000;

export interface RateLimitPolicy {
  scope: string;
  capacity: number;
  /** Tokens restored per second. For 10/minute use `10 / 60`. */
  refillPerSecond: number;
  cost?: number;
  /** Retain an idle bucket at least this long. Defaults to >= one hour. */
  idleTtlSeconds?: number;
}

export interface RateLimitRequest {
  subjectHash: string;
  policy: RateLimitPolicy;
}

export interface RateLimitDecision {
  allowed: boolean;
  scope: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export interface RateLimitBucketProjection {
  allowed: boolean;
  tokens: number;
  retryAfterSeconds: number;
}

export class RateLimitDeniedError extends Error {
  constructor(readonly decision: RateLimitDecision) {
    super("rate_limited");
    this.name = "RateLimitDeniedError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("rate_limit_unavailable", options);
    this.name = "RateLimitUnavailableError";
  }
}

class RollbackDenied extends Error {
  constructor(readonly decision: RateLimitDecision) {
    super("rollback_rate_limit_denial");
  }
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validate(subjectHash: string, policy: RateLimitPolicy) {
  const cost = policy.cost ?? 1;
  if (
    !subjectHash ||
    subjectHash.length > MAX_SUBJECT_LENGTH ||
    !policy.scope ||
    policy.scope.length > MAX_SCOPE_LENGTH ||
    !Number.isSafeInteger(policy.capacity) ||
    policy.capacity <= 0 ||
    policy.capacity > MAX_CAPACITY ||
    !positiveFinite(policy.refillPerSecond) ||
    !positiveFinite(cost) ||
    cost > policy.capacity ||
    (policy.idleTtlSeconds !== undefined &&
      (!Number.isSafeInteger(policy.idleTtlSeconds) ||
        policy.idleTtlSeconds <= 0))
  ) {
    throw new TypeError("invalid_rate_limit_policy");
  }
  return cost;
}

/** Deterministic reference semantics for the SQL transition below. */
export function projectRateLimitBucket(
  tokens: number,
  elapsedSeconds: number,
  policy: Pick<RateLimitPolicy, "capacity" | "refillPerSecond" | "cost">,
): RateLimitBucketProjection {
  const cost = policy.cost ?? 1;
  if (
    !Number.isFinite(tokens) ||
    tokens < 0 ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    !Number.isSafeInteger(policy.capacity) ||
    policy.capacity <= 0 ||
    !positiveFinite(policy.refillPerSecond) ||
    !positiveFinite(cost) ||
    cost > policy.capacity
  ) {
    throw new TypeError("invalid_rate_limit_projection");
  }
  const available = Math.min(
    policy.capacity,
    tokens + elapsedSeconds * policy.refillPerSecond,
  );
  if (available >= cost) {
    return { allowed: true, tokens: available - cost, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    tokens,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((cost - available) / policy.refillPerSecond),
    ),
  };
}

export {
  rateLimitIpSubject,
  rateLimitSubject,
  rateLimitUserSubject,
} from "@/lib/rate-limit/identity";

async function consumeWithinTx(
  tx: DbTx,
  subjectHash: string,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const cost = validate(subjectHash, policy);
  const ttlSeconds = Math.max(
    3_600,
    policy.idleTtlSeconds ?? 0,
    Math.ceil((policy.capacity / policy.refillPerSecond) * 2),
  );
  const available = sql`least(
    ${policy.capacity}::double precision,
    ${rateLimitBuckets.tokens} + greatest(
      0,
      extract(epoch from (clock_timestamp() - ${rateLimitBuckets.updatedAt}))
    ) * ${policy.refillPerSecond}::double precision
  )`;

  const [consumed] = await tx
    .insert(rateLimitBuckets)
    .values({
      scope: policy.scope,
      subjectHash,
      tokens: policy.capacity - cost,
      capacity: policy.capacity,
      refillPerSecond: policy.refillPerSecond,
      updatedAt: sql`clock_timestamp()`,
      expiresAt: sql`clock_timestamp() + ${ttlSeconds} * interval '1 second'`,
    })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.scope, rateLimitBuckets.subjectHash],
      set: {
        tokens: sql`${available} - ${cost}`,
        capacity: policy.capacity,
        refillPerSecond: policy.refillPerSecond,
        updatedAt: sql`clock_timestamp()`,
        expiresAt: sql`clock_timestamp() + ${ttlSeconds} * interval '1 second'`,
      },
      where: sql`${available} >= ${cost}`,
    })
    .returning({
      tokens: rateLimitBuckets.tokens,
      updatedAt: rateLimitBuckets.updatedAt,
    });

  if (consumed) {
    const tokens = Number(consumed.tokens);
    const secondsToFull = (policy.capacity - tokens) / policy.refillPerSecond;
    return {
      allowed: true,
      scope: policy.scope,
      limit: policy.capacity,
      remaining: Math.max(0, Math.floor(tokens)),
      resetAt: new Date(consumed.updatedAt.getTime() + secondsToFull * 1_000),
      retryAfterSeconds: 0,
    };
  }

  // The failed conflict update locked this bucket for the transaction. Reading
  // its DB-clock availability is stable until this transaction ends.
  const [denied] = await tx
    .select({
      available: sql<number>`least(
        ${policy.capacity}::double precision,
        ${rateLimitBuckets.tokens} + greatest(
          0,
          extract(epoch from (clock_timestamp() - ${rateLimitBuckets.updatedAt}))
        ) * ${policy.refillPerSecond}::double precision
      )`,
      databaseNow: sql`clock_timestamp()`.mapWith(rateLimitBuckets.updatedAt),
    })
    .from(rateLimitBuckets)
    .where(
      and(
        eq(rateLimitBuckets.scope, policy.scope),
        eq(rateLimitBuckets.subjectHash, subjectHash),
      ),
    )
    .limit(1);
  if (!denied) throw new Error("rate_limit_bucket_missing_after_conflict");
  const current = Math.max(0, Number(denied.available));
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((cost - current) / policy.refillPerSecond),
  );
  return {
    allowed: false,
    scope: policy.scope,
    limit: policy.capacity,
    remaining: Math.max(0, Math.floor(current)),
    resetAt: new Date(denied.databaseNow.getTime() + retryAfterSeconds * 1_000),
    retryAfterSeconds,
  };
}

/** Consume all policies atomically. A denial throws inside the transaction so
 * earlier successful buckets roll back rather than charging a rejected call. */
export async function consumeRateLimits(
  requests: readonly RateLimitRequest[],
): Promise<RateLimitDecision[]> {
  if (requests.length === 0) throw new TypeError("rate_limit_policy_required");
  const ordered = [...requests].sort(
    (left, right) =>
      left.policy.scope.localeCompare(right.policy.scope) ||
      left.subjectHash.localeCompare(right.subjectHash),
  );
  const identities = new Set<string>();
  for (const request of ordered) {
    validate(request.subjectHash, request.policy);
    const identity = `${request.policy.scope}\0${request.subjectHash}`;
    if (identities.has(identity)) {
      throw new TypeError("duplicate_rate_limit_policy");
    }
    identities.add(identity);
  }
  try {
    return await getDb().transaction(async (tx) => {
      const decisions: RateLimitDecision[] = [];
      for (const request of ordered) {
        const decision = await consumeWithinTx(
          tx,
          request.subjectHash,
          request.policy,
        );
        if (!decision.allowed) throw new RollbackDenied(decision);
        decisions.push(decision);
      }
      return decisions;
    });
  } catch (error) {
    if (error instanceof RollbackDenied) return [error.decision];
    throw new RateLimitUnavailableError({ cause: error });
  }
}

export async function consumeRateLimit(
  subjectHash: string,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  return (await consumeRateLimits([{ subjectHash, policy }]))[0];
}

export function rateLimitErrorResponse(
  decisionOrError: RateLimitDecision | RateLimitUnavailableError,
): Response {
  if (decisionOrError instanceof RateLimitUnavailableError) {
    return Response.json(
      { error: "rate_limit_unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      },
    );
  }
  const decision = decisionOrError;
  return Response.json(
    { error: "rate_limited", retryAfter: decision.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(decision.retryAfterSeconds),
        "RateLimit-Limit": String(decision.limit),
        "RateLimit-Remaining": String(decision.remaining),
        "RateLimit-Reset": String(decision.retryAfterSeconds),
      },
    },
  );
}

/** Delete a bounded batch so maintenance cannot monopolize the database. */
export async function cleanupExpiredRateLimitBuckets(
  limit = 500,
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_BATCH_SIZE) {
    throw new TypeError("invalid_rate_limit_cleanup_batch");
  }
  return getDb().transaction(async (tx) => {
    const expired = await tx
      .select({
        scope: rateLimitBuckets.scope,
        subjectHash: rateLimitBuckets.subjectHash,
      })
      .from(rateLimitBuckets)
      .where(lte(rateLimitBuckets.expiresAt, sql`clock_timestamp()`))
      .orderBy(asc(rateLimitBuckets.expiresAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    for (const row of expired) {
      await tx
        .delete(rateLimitBuckets)
        .where(
          and(
            eq(rateLimitBuckets.scope, row.scope),
            eq(rateLimitBuckets.subjectHash, row.subjectHash),
          ),
        );
    }
    return expired.length;
  });
}
