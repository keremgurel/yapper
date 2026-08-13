import { createHmac } from "node:crypto";
import ipaddr from "ipaddr.js";

const TRUSTED_PROXY = "vercel";
const UNKNOWN_CLIENT = "unknown";
const SUBJECT_DOMAIN = "yapper-rate-limit-subject-v1\0";
const MIN_SECRET_BYTES = 32;

export interface RateLimitIdentityEnvironment {
  [key: string]: string | undefined;
  RATE_LIMIT_SUBJECT_SECRET?: string;
  RATE_LIMIT_TRUST_PROXY?: string;
}

export interface RateLimitClientIdentity {
  /** Stable HMAC digest. Safe to persist and log; never contains the raw IP. */
  subject: string;
  source: "vercel" | "unknown";
}

/**
 * Canonicalize an address for rate-limit identity. IPv6 clients are grouped by
 * /64 so privacy addresses cannot mint a fresh bucket merely by rotating the
 * interface identifier. Ambiguous IPv4 forms and proxy lists are rejected.
 */
export function normalizeClientIp(value: string): string | null {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > 128 ||
    candidate.includes(",") ||
    candidate.includes("%") ||
    candidate.includes("/")
  ) {
    return null;
  }

  try {
    const parsed = ipaddr.parse(candidate);
    if (parsed.kind() === "ipv4") {
      // ipaddr accepts historical shorthand and octal IPv4 spellings. Headers
      // must use the unambiguous four-part decimal representation.
      if (!ipaddr.IPv4.isValidFourPartDecimal(candidate)) return null;
      return parsed.toString();
    }

    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      return ipv6.toIPv4Address().toString();
    }

    const bytes = ipv6.toByteArray();
    bytes.fill(0, 8);
    return ipaddr.fromByteArray(bytes).toString();
  } catch {
    return null;
  }
}

/**
 * Read the client address only when the deployment explicitly declares Vercel
 * as its trusted proxy. Vercel documents `x-vercel-forwarded-for` as the stable
 * copy when another proxy may overwrite X-Forwarded-For. No generic proxy or
 * vendor fallbacks are accepted.
 */
export function trustedClientIp(
  request: Request,
  environment: RateLimitIdentityEnvironment = process.env,
): string | null {
  if (environment.RATE_LIMIT_TRUST_PROXY !== TRUSTED_PROXY) return null;

  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded !== null) return normalizeClientIp(vercelForwarded);

  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded === null ? null : normalizeClientIp(forwarded);
}

/** Pseudonymize any rate-limit actor before it reaches storage or telemetry. */
export function rateLimitSubject(
  kind: string,
  value: string,
  secret: string | undefined = process.env.RATE_LIMIT_SUBJECT_SECRET,
): string {
  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error("RATE_LIMIT_SUBJECT_SECRET must contain at least 32 bytes");
  }
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(kind) || !value) {
    throw new TypeError("invalid_rate_limit_subject");
  }
  return createHmac("sha256", secret)
    .update(SUBJECT_DOMAIN)
    .update(kind)
    .update("\0")
    .update(value)
    .digest("hex");
}

export function rateLimitUserSubject(
  userId: string,
  environment: RateLimitIdentityEnvironment = process.env,
): string {
  return rateLimitSubject(
    "user",
    userId,
    environment.RATE_LIMIT_SUBJECT_SECRET,
  );
}

/**
 * Resolve the IP actor used by the durable limiter. Unknown or untrusted
 * clients intentionally share one bounded bucket instead of bypassing limits.
 */
export function rateLimitClientIdentity(
  request: Request,
  environment: RateLimitIdentityEnvironment = process.env,
): RateLimitClientIdentity {
  const normalized = trustedClientIp(request, environment);
  return {
    subject: rateLimitSubject(
      "ip",
      normalized ?? UNKNOWN_CLIENT,
      environment.RATE_LIMIT_SUBJECT_SECRET,
    ),
    source: normalized === null ? "unknown" : "vercel",
  };
}

export function rateLimitIpSubject(
  request: Request,
  environment: RateLimitIdentityEnvironment = process.env,
): string {
  return rateLimitClientIdentity(request, environment).subject;
}
