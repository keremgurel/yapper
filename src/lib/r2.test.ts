import { describe, expect, it } from "vitest";
import { mediaKey, ownsKey } from "@/lib/r2";

describe("ownsKey", () => {
  it("accepts a key under the user's own prefix", () => {
    expect(ownsKey("user_1", "u/user_1/clip.mp4")).toBe(true);
    expect(ownsKey("user_1", "u/user_1/nested/clip.mp4")).toBe(true);
  });

  it("rejects a different user's key", () => {
    expect(ownsKey("user_1", "u/user_2/clip.mp4")).toBe(false);
  });

  it("rejects a prefix-sibling whose id merely starts the same (no IDOR)", () => {
    // The trailing slash is what stops "user_1" from owning "user_12"'s media.
    expect(ownsKey("user_1", "u/user_12/clip.mp4")).toBe(false);
    expect(ownsKey("user_1", "u/user_1extra/clip.mp4")).toBe(false);
  });

  it("rejects a key that isn't under any user prefix", () => {
    expect(ownsKey("user_1", "public/clip.mp4")).toBe(false);
    expect(ownsKey("user_1", "user_1/clip.mp4")).toBe(false); // missing the u/ root
  });
});

describe("mediaKey", () => {
  it("namespaces the key so its own owner passes ownsKey", () => {
    const k = mediaKey("user_1", "sub_9", "webm");
    expect(k).toBe("u/user_1/sub_9.webm");
    expect(ownsKey("user_1", k)).toBe(true);
  });

  it("does not let a prefix-sibling own another user's generated key", () => {
    expect(ownsKey("user_1", mediaKey("user_12", "sub_9", "mp4"))).toBe(false);
  });
});
