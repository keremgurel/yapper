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
  | "transcribe"
  | "clean-transcript"
  | "place-overlays"
  | "generate-hooks"
  | "generate-idea"
  | "generate-script"
  | "brain-ask"
  | "brain-spin"
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
  "content-capture": { capacity: 3, refillPerSecond: 12 / HOUR },
  "content-brainstorm": { capacity: 3, refillPerSecond: 12 / HOUR },
  "ideas-expand": { capacity: 3, refillPerSecond: 12 / HOUR },
  "inspiration-creator": { capacity: 2, refillPerSecond: 10 / HOUR },
  "inspiration-resolve": { capacity: 3, refillPerSecond: 20 / HOUR },
  "publish-caption": { capacity: 3, refillPerSecond: 20 / HOUR },
  "instagram-import": { capacity: 2, refillPerSecond: 10 / DAY },
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
