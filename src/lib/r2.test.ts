import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mediaKey, ownsKey } from "@/lib/r2";

const originalEnvironment = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.R2_ENDPOINT = "https://account.example.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET = "test-bucket";
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("ownsKey", () => {
  it("accepts a key under the user's own prefix", () => {
    expect(ownsKey("user_1", "u/user_1/clip.mp4")).toBe(true);
    expect(ownsKey("user_1", "u/user_1/nested/clip.mp4")).toBe(true);
  });

  it("rejects a different user's key", () => {
    expect(ownsKey("user_1", "u/user_2/clip.mp4")).toBe(false);
  });

  it("rejects a prefix-sibling whose id merely starts the same (no IDOR)", () => {
    expect(ownsKey("user_1", "u/user_12/clip.mp4")).toBe(false);
    expect(ownsKey("user_1", "u/user_1extra/clip.mp4")).toBe(false);
  });

  it("rejects a key that isn't under any user prefix", () => {
    expect(ownsKey("user_1", "public/clip.mp4")).toBe(false);
    expect(ownsKey("user_1", "user_1/clip.mp4")).toBe(false);
  });
});

describe("mediaKey", () => {
  it("namespaces the key so its own owner passes ownsKey", () => {
    const key = mediaKey("user_1", "sub_9", "webm");
    expect(key).toBe("u/user_1/sub_9.webm");
    expect(ownsKey("user_1", key)).toBe(true);
  });

  it("does not let a prefix-sibling own another user's generated key", () => {
    expect(ownsKey("user_1", mediaKey("user_12", "sub_9", "mp4"))).toBe(false);
  });
});

describe("presignUpload", () => {
  it("cryptographically binds the claimed upload length", async () => {
    const { presignUpload } = await import("./r2");

    const signed = new URL(
      await presignUpload("u/user_a/video.mp4", "video/mp4", 12_345, 600),
    );

    expect(
      signed.searchParams.get("X-Amz-SignedHeaders")?.split(";"),
    ).toContain("content-length");
  });
});
