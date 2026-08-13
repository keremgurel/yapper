import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeClientIp,
  rateLimitClientIdentity,
  rateLimitIpSubject,
  rateLimitSubject,
  rateLimitUserSubject,
  trustedClientIp,
  type RateLimitIdentityEnvironment,
} from "./identity";

const secret = "0123456789abcdef0123456789abcdef";
const trusted: RateLimitIdentityEnvironment = {
  RATE_LIMIT_TRUST_PROXY: "vercel",
  RATE_LIMIT_SUBJECT_SECRET: secret,
};

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://ypr.app/api/expensive", { headers });
}

describe("normalizeClientIp", () => {
  it.each([
    ["192.0.2.1", "192.0.2.1"],
    [" 192.0.2.1 ", "192.0.2.1"],
    ["::ffff:192.0.2.128", "192.0.2.128"],
    ["::FFFF:c000:0280", "192.0.2.128"],
    ["2001:0db8:abcd:0012:1111:2222:3333:4444", "2001:db8:abcd:12::"],
    ["2001:db8:abcd:12::ffff", "2001:db8:abcd:12::"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeClientIp(input)).toBe(expected);
  });

  it.each([
    "",
    "not-an-ip",
    "192.0.2.1, 198.51.100.2",
    "192.0.2.1:443",
    "[2001:db8::1]",
    "2001:db8::1%eth0",
    "2001:db8::/64",
    "010.0.0.1",
    "127.1",
    "1.2.3.999",
  ])("rejects ambiguous or malformed value %s", (input) => {
    expect(normalizeClientIp(input)).toBeNull();
  });

  it("separates different IPv6 /64 networks", () => {
    expect(normalizeClientIp("2001:db8:abcd:12::1")).not.toBe(
      normalizeClientIp("2001:db8:abcd:13::1"),
    );
  });
});

describe("trustedClientIp", () => {
  it("uses Vercel's stable forwarded header when trust is explicit", () => {
    expect(
      trustedClientIp(
        request({
          "x-vercel-forwarded-for": "2001:db8:abcd:12::1234",
          "x-forwarded-for": "198.51.100.2",
        }),
        trusted,
      ),
    ).toBe("2001:db8:abcd:12::");
  });

  it("accepts Vercel's overwritten X-Forwarded-For when the stable copy is absent", () => {
    expect(
      trustedClientIp(request({ "x-forwarded-for": "198.51.100.2" }), trusted),
    ).toBe("198.51.100.2");
  });

  it.each([undefined, "", "true", "VERCEL", "cloudflare"])(
    "ignores forwarding headers without exact Vercel trust (%s)",
    (mode) => {
      expect(
        trustedClientIp(
          request({
            "x-vercel-forwarded-for": "192.0.2.1",
            "x-forwarded-for": "192.0.2.2",
          }),
          { ...trusted, RATE_LIMIT_TRUST_PROXY: mode },
        ),
      ).toBeNull();
    },
  );

  it("never trusts arbitrary fallback vendor headers", () => {
    expect(
      trustedClientIp(
        request({
          "x-real-ip": "192.0.2.1",
          "cf-connecting-ip": "192.0.2.2",
          "fly-client-ip": "192.0.2.3",
        }),
        trusted,
      ),
    ).toBeNull();
  });

  it("rejects a list instead of guessing which proxy entry is trustworthy", () => {
    expect(
      trustedClientIp(
        request({
          "x-vercel-forwarded-for": "192.0.2.1, 198.51.100.2",
          "x-forwarded-for": "203.0.113.3",
        }),
        trusted,
      ),
    ).toBeNull();
  });
});

describe("rate-limit subjects", () => {
  it("returns the expected stable 64-character HMAC without exposing input", () => {
    const expected = createHmac("sha256", secret)
      .update("yapper-rate-limit-subject-v1\0")
      .update("user")
      .update("\0")
      .update("user_123")
      .digest("hex");
    const subject = rateLimitSubject("user", "user_123", secret);

    expect(subject).toBe(expected);
    expect(subject).toMatch(/^[a-f0-9]{64}$/);
    expect(subject).not.toContain("user_123");
  });

  it.each([undefined, "", "short", "é".repeat(15)])(
    "fails closed for a missing or weak HMAC secret",
    (weakSecret) => {
      expect(() => rateLimitSubject("user", "actor", weakSecret)).toThrow(
        /at least 32 bytes/,
      );
    },
  );

  it("measures secret strength in bytes rather than JavaScript characters", () => {
    expect(rateLimitSubject("user", "actor", "é".repeat(16))).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("domain-separates actor kinds and exposes the shared user helper", () => {
    expect(rateLimitSubject("user", "same", secret)).not.toBe(
      rateLimitSubject("ip", "same", secret),
    );
    expect(
      rateLimitUserSubject("user_123", {
        RATE_LIMIT_SUBJECT_SECRET: secret,
      }),
    ).toBe(rateLimitSubject("user", "user_123", secret));
  });

  it.each([
    ["", "actor"],
    ["User", "actor"],
    ["space kind", "actor"],
    ["a".repeat(33), "actor"],
    ["user", ""],
  ])("rejects an invalid subject namespace or empty value", (kind, value) => {
    expect(() => rateLimitSubject(kind, value, secret)).toThrow(
      "invalid_rate_limit_subject",
    );
  });

  it("gives equivalent IPv6 addresses one subject and distinct /64s different subjects", () => {
    const first = rateLimitIpSubject(
      request({ "x-vercel-forwarded-for": "2001:db8:abcd:12::1" }),
      trusted,
    );
    const rotated = rateLimitIpSubject(
      request({
        "x-vercel-forwarded-for": "2001:0db8:abcd:0012:ffff::99",
      }),
      trusted,
    );
    const otherNetwork = rateLimitIpSubject(
      request({ "x-vercel-forwarded-for": "2001:db8:abcd:13::1" }),
      trusted,
    );

    expect(first).toBe(rotated);
    expect(first).not.toBe(otherNetwork);
  });

  it("gives IPv4-mapped IPv6 and IPv4 the same subject", () => {
    expect(
      rateLimitIpSubject(
        request({ "x-vercel-forwarded-for": "::ffff:192.0.2.128" }),
        trusted,
      ),
    ).toBe(
      rateLimitIpSubject(
        request({ "x-vercel-forwarded-for": "192.0.2.128" }),
        trusted,
      ),
    );
  });

  it("uses one stable bounded unknown bucket for missing, malformed, and untrusted IPs", () => {
    const missing = rateLimitClientIdentity(request(), trusted);
    const malformed = rateLimitClientIdentity(
      request({ "x-vercel-forwarded-for": "192.0.2.1, 198.51.100.2" }),
      trusted,
    );
    const untrusted = rateLimitClientIdentity(
      request({ "x-vercel-forwarded-for": "192.0.2.1" }),
      { ...trusted, RATE_LIMIT_TRUST_PROXY: undefined },
    );

    expect(missing).toEqual({
      subject: rateLimitSubject("ip", "unknown", secret),
      source: "unknown",
    });
    expect(malformed).toEqual(missing);
    expect(untrusted).toEqual(missing);
  });

  it("reports only trust provenance, never the normalized address", () => {
    const identity = rateLimitClientIdentity(
      request({ "x-vercel-forwarded-for": "192.0.2.1" }),
      trusted,
    );

    expect(identity.source).toBe("vercel");
    expect(JSON.stringify(identity)).not.toContain("192.0.2.1");
  });
});
