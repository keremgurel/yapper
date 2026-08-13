export type RateLimitOutcome = "allowed" | "denied" | "unavailable";

export interface RateLimitTelemetry {
  outcome: RateLimitOutcome;
  /** Policy name only; never a subject hash or caller-controlled value. */
  scope: string;
  actor: "user" | "ip" | "user+ip" | "email";
  unknownIp?: boolean;
}

/** Structured platform logs are the always-on telemetry sink. The deliberately
 * small fixed vocabulary prevents raw ids, addresses, emails, or hashes from
 * reaching logs while still exposing denial/unavailability/unknown-IP rates. */
export function recordRateLimitTelemetry(event: RateLimitTelemetry): void {
  console.info("[rate-limit]", {
    outcome: event.outcome,
    scope: event.scope,
    actor: event.actor,
    ...(event.unknownIp === undefined ? {} : { unknownIp: event.unknownIp }),
  });
}
