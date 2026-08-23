import {
  consumeRateLimit,
  consumeRateLimits,
  rateLimitErrorResponse,
  rateLimitUserSubject,
  RateLimitUnavailableError,
  type RateLimitPolicy,
} from "@/lib/db/rate-limit";
import { rateLimitClientIdentity } from "@/lib/rate-limit/identity";
import { recordRateLimitTelemetry } from "@/lib/rate-limit/telemetry";

export type ProviderSpendEndpoint =
  | "feedback"
  | "training-feedback"
  | "transcribe"
  | "clean-transcript"
  | "place-overlays"
  | "generate-hooks"
  | "generate-idea"
  | "generate-script"
  | "brain-ask"
  | "brain-spin"
  | "brain-ingest"
  | "brain-route"
  | "content-capture"
  | "content-brainstorm"
  | "ideas-expand"
  | "inspiration-creator"
  | "inspiration-resolve"
  | "publish-caption"
  | "instagram-import";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

const ENDPOINT_POLICIES: Record<
  ProviderSpendEndpoint,
  Pick<RateLimitPolicy, "capacity" | "refillPerSecond">
> = {
  feedback: { capacity: 2, refillPerSecond: 6 / HOUR },
  "training-feedback": { capacity: 3, refillPerSecond: 20 / HOUR },
  // An edit is one transcription and one cleanup, and a creator working
  // through a shoot runs several in a row. These were set when the editor sent
  // a take as a dozen separate chunked requests, so four transcriptions meant
  // one video; now four would mean four videos and a three minute wait for the
  // fifth.
  transcribe: { capacity: 12, refillPerSecond: 60 / HOUR },
  "clean-transcript": { capacity: 12, refillPerSecond: 60 / HOUR },
  "place-overlays": { capacity: 2, refillPerSecond: 15 / HOUR },
  "generate-hooks": { capacity: 3, refillPerSecond: 20 / HOUR },
  "generate-idea": { capacity: 3, refillPerSecond: 20 / HOUR },
  "generate-script": { capacity: 3, refillPerSecond: 20 / HOUR },
  "brain-ask": { capacity: 3, refillPerSecond: 12 / HOUR },
  "brain-spin": { capacity: 3, refillPerSecond: 12 / HOUR },
  "brain-ingest": { capacity: 4, refillPerSecond: 20 / HOUR },
  // Routing is infrastructure, not a feature: it rides along with a generation
  // the creator already paid for, so the ceiling is set to catch a runaway loop
  // rather than to ration the creator. Running out costs them nothing but a
  // slightly blunter selection.
  "brain-route": { capacity: 40, refillPerSecond: 400 / HOUR },
  "content-capture": { capacity: 3, refillPerSecond: 12 / HOUR },
  "content-brainstorm": { capacity: 3, refillPerSecond: 12 / HOUR },
  "ideas-expand": { capacity: 3, refillPerSecond: 12 / HOUR },
  "inspiration-creator": { capacity: 2, refillPerSecond: 10 / HOUR },
  "inspiration-resolve": { capacity: 3, refillPerSecond: 20 / HOUR },
  "publish-caption": { capacity: 3, refillPerSecond: 20 / HOUR },
  // Two at a time refilling ten a day was set as a guard on someone else's
  // API, but it is also the ceiling on cross-posting a week of clips, and a
  // creator who hits it waits two and a half hours for the next one.
  "instagram-import": { capacity: 8, refillPerSecond: 40 / DAY },
};

/** High-ceiling pre-body flood protection. This is deliberately distinct from
 * provider spend so malformed requests cannot exhaust a user's paid budget. */
export async function guardProviderIngress(
  request: Request,
): Promise<Response | null> {
  let unknownIp: boolean | undefined;
  try {
    const identity = rateLimitClientIdentity(request);
    unknownIp = identity.source === "unknown";
    const decision = await consumeRateLimit(identity.subject, {
      scope: "ip:provider-ingress",
      capacity: 100,
      refillPerSecond: 300 / HOUR,
    });
    recordRateLimitTelemetry({
      outcome: decision.allowed ? "allowed" : "denied",
      scope: "ip:provider-ingress",
      actor: "ip",
      unknownIp,
    });
    return decision.allowed ? null : rateLimitErrorResponse(decision);
  } catch (error) {
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: "ip:provider-ingress",
      actor: "ip",
      unknownIp,
    });
    return rateLimitErrorResponse(
      error instanceof RateLimitUnavailableError
        ? error
        : new RateLimitUnavailableError({ cause: error }),
    );
  }
}

/** Fail-closed guard for authenticated routes that can spend provider money. */
export async function guardProviderSpend(
  request: Request,
  userId: string,
  endpoint: ProviderSpendEndpoint,
): Promise<Response | null> {
  const endpointPolicy = ENDPOINT_POLICIES[endpoint];
  let unknownIp: boolean | undefined;
  try {
    const userSubject = rateLimitUserSubject(userId);
    const clientIdentity = rateLimitClientIdentity(request);
    unknownIp = clientIdentity.source === "unknown";
    const decisions = await consumeRateLimits([
      {
        subjectHash: userSubject,
        policy: {
          scope: "user:provider-spend",
          capacity: 40,
          refillPerSecond: 400 / DAY,
        },
      },
      {
        subjectHash: userSubject,
        policy: {
          scope: `user:provider-spend:${endpoint}`,
          ...endpointPolicy,
        },
      },
      {
        subjectHash: clientIdentity.subject,
        policy: {
          scope: "ip:provider-spend",
          capacity: 120,
          refillPerSecond: 1_000 / DAY,
        },
      },
    ]);
    const denied = decisions.find((decision) => !decision.allowed);
    recordRateLimitTelemetry({
      outcome: denied ? "denied" : "allowed",
      scope: denied?.scope ?? `user:provider-spend:${endpoint}`,
      actor: "user+ip",
      unknownIp,
    });
    return denied ? rateLimitErrorResponse(denied) : null;
  } catch (error) {
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: `user:provider-spend:${endpoint}`,
      actor: "user+ip",
      unknownIp,
    });
    return rateLimitErrorResponse(
      error instanceof RateLimitUnavailableError
        ? error
        : new RateLimitUnavailableError({ cause: error }),
    );
  }
}

/**
 * The limiter for context routing, which is not like the others.
 *
 * Every other provider call here is something the creator asked for, so its
 * guard returns a 429 and the request stops. Routing is a call we make on their
 * behalf inside a generation they already paid for, so it must not touch the
 * shared `user:provider-spend` budget (spending their generation allowance on
 * plumbing would be indefensible) and it must not be able to fail their
 * request.
 *
 * So this consumes only its own scope and answers a question rather than
 * returning a response: may we route. False means the caller uses the
 * deterministic selection instead, which the creator will not notice.
 */
export async function guardRouterSpend(userId: string): Promise<boolean> {
  try {
    const decision = await consumeRateLimit(rateLimitUserSubject(userId), {
      scope: "user:provider-spend:brain-route",
      ...ENDPOINT_POLICIES["brain-route"],
    });
    recordRateLimitTelemetry({
      outcome: decision.allowed ? "allowed" : "denied",
      scope: "user:provider-spend:brain-route",
      actor: "user",
    });
    return decision.allowed;
  } catch {
    // The limiter being unavailable is not a reason to skip a generation, and
    // it is not a reason to make an unmetered provider call either.
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: "user:provider-spend:brain-route",
      actor: "user",
    });
    return false;
  }
}
