import { describe, expect, it } from "vitest";
import { isRejectedLogin } from "./rejected-login";

describe("telling a revoked login from a passing failure", () => {
  it("treats a refused refresh as revoked", () => {
    expect(isRejectedLogin(new Error("oauth_refresh_400"))).toBe(true);
    expect(isRejectedLogin(new Error("oauth_refresh_401"))).toBe(true);
  });

  it("treats Instagram's invalidated session as revoked", () => {
    const error = Object.assign(new Error("instagram_media_400"), {
      graphCode: 190,
    });
    expect(isRejectedLogin(error)).toBe(true);
  });

  it("leaves outages and odd answers alone", () => {
    for (const message of [
      "oauth_refresh_500",
      "oauth_refresh_429",
      "oauth_refresh_no_token",
      "fetch failed",
    ])
      expect(isRejectedLogin(new Error(message)), message).toBe(false);
    expect(isRejectedLogin("oauth_refresh_400")).toBe(false);
    expect(
      isRejectedLogin(Object.assign(new Error("x"), { graphCode: 4 })),
    ).toBe(false);
  });
});
