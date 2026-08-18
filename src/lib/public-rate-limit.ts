import {
  consumeRateLimit,
  rateLimitErrorResponse,
  rateLimitSubject,
  RateLimitUnavailableError,
  type RateLimitPolicy,
} from "@/lib/db/rate-limit";
import { rateLimitClientIdentity } from "@/lib/rate-limit/identity";
import { recordRateLimitTelemetry } from "@/lib/rate-limit/telemetry";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

async function guardPublicSubject(
  subject: () => string,
  policy: RateLimitPolicy,
  actor: "ip" | "email",
  unknownIp?: boolean,
): Promise<Response | null> {
  try {
    const decision = await consumeRateLimit(subject(), policy);
    recordRateLimitTelemetry({
      outcome: decision.allowed ? "allowed" : "denied",
      scope: policy.scope,
      actor,
      unknownIp,
    });
    return decision.allowed ? null : rateLimitErrorResponse(decision);
  } catch (error) {
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: policy.scope,
      actor,
      unknownIp,
    });
    return rateLimitErrorResponse(
      error instanceof RateLimitUnavailableError
        ? error
        : new RateLimitUnavailableError({ cause: error }),
    );
  }
}

export function guardWaitlistIp(request: Request): Promise<Response | null> {
  try {
    const identity = rateLimitClientIdentity(request);
    return guardPublicSubject(
      () => identity.subject,
      { scope: "waitlist:ip", capacity: 2, refillPerSecond: 5 / HOUR },
      "ip",
      identity.source === "unknown",
    );
  } catch (error) {
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: "waitlist:ip",
      actor: "ip",
      unknownIp: true,
    });
    return Promise.resolve(
      rateLimitErrorResponse(new RateLimitUnavailableError({ cause: error })),
    );
  }
}

export function guardWaitlistEmail(email: string): Promise<Response | null> {
  return guardPublicSubject(
    () => rateLimitSubject("email", email),
    { scope: "waitlist:email", capacity: 1, refillPerSecond: 3 / DAY },
    "email",
  );
}

/**
 * The Studio password is a single shared secret in front of an unfinished
 * product, so brute force is the only realistic attack on it. Five attempts
 * with a slow refill makes guessing impractical without inconveniencing a
 * tester who fat-fingers it twice.
 */
export function guardStudioAccessIp(
  request: Request,
): Promise<Response | null> {
  try {
    const identity = rateLimitClientIdentity(request);
    return guardPublicSubject(
      () => identity.subject,
      { scope: "studio-access:ip", capacity: 5, refillPerSecond: 10 / HOUR },
      "ip",
      identity.source === "unknown",
    );
  } catch (error) {
    recordRateLimitTelemetry({
      outcome: "unavailable",
      scope: "studio-access:ip",
      actor: "ip",
      unknownIp: true,
    });
    return Promise.resolve(
      rateLimitErrorResponse(new RateLimitUnavailableError({ cause: error })),
    );
  }
}
