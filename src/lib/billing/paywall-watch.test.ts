import { describe, expect, it } from "vitest";
import { isStudioPaywallPath, paywallReason } from "./paywall-watch";

describe("the Studio paywall watch", () => {
  it("handles Studio API refusals and leaves Train feedback alone", () => {
    expect(isStudioPaywallPath("/api/generate/script")).toBe(true);
    expect(isStudioPaywallPath("/api/transcribe")).toBe(true);
    expect(isStudioPaywallPath("/api/training/feedback")).toBe(false);
    expect(isStudioPaywallPath("/studio/home")).toBe(false);
    expect(isStudioPaywallPath(null)).toBe(false);
  });

  it("recognizes only the two billing refusals", () => {
    expect(paywallReason({ error: "not_entitled" })).toBe("not_entitled");
    expect(paywallReason({ error: "insufficient_credits" })).toBe(
      "insufficient_credits",
    );
    expect(paywallReason({ error: "rate_limited" })).toBeNull();
    expect(paywallReason(null)).toBeNull();
    expect(paywallReason("not_entitled")).toBeNull();
  });
});
