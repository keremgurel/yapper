import { describe, expect, it } from "vitest";
import { refreshFailureReason } from "./refresh-failure";

describe("refreshFailureReason", () => {
  it("passes our own refresh codes through", () => {
    expect(refreshFailureReason(new Error("oauth_refresh_500"))).toBe(
      "oauth_refresh_500",
    );
    expect(
      refreshFailureReason(new Error("oauth_refresh_invalid_client")),
    ).toBe("oauth_refresh_invalid_client");
  });

  it("names a non-JSON answer and an unreachable provider", () => {
    expect(refreshFailureReason(new SyntaxError("Unexpected token <"))).toBe(
      "oauth_refresh_bad_response",
    );
    expect(refreshFailureReason(new TypeError("fetch failed"))).toBe(
      "oauth_refresh_unreachable",
    );
  });

  it("never repeats anything else", () => {
    expect(refreshFailureReason(new Error("token=abc secret"))).toBe("unknown");
    expect(refreshFailureReason("oauth_refresh_400")).toBe("unknown");
  });
});
