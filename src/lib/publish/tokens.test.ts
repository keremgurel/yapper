import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptToken,
  tokenCryptoConfigured,
} from "@/lib/publish/tokens";

const KEY = Buffer.alloc(32, 7).toString("base64"); // deterministic 32-byte key

describe("token crypto", () => {
  const saved = process.env.PUBLISH_TOKEN_KEY;
  beforeEach(() => {
    process.env.PUBLISH_TOKEN_KEY = KEY;
  });
  afterEach(() => {
    process.env.PUBLISH_TOKEN_KEY = saved;
  });

  it("round-trips a token", () => {
    const secret = "ya29.a0Af-refresh-token-value";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptToken("same");
    const b = encryptToken("same");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same");
    expect(decryptToken(b)).toBe("same");
  });

  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const enc = encryptToken("secret");
    const bytes = Buffer.from(enc, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptToken(bytes.toString("base64"))).toThrow();
  });

  it("reports configured only with a valid 32-byte key", () => {
    expect(tokenCryptoConfigured()).toBe(true);
    process.env.PUBLISH_TOKEN_KEY = Buffer.alloc(16).toString("base64");
    expect(tokenCryptoConfigured()).toBe(false);
    delete process.env.PUBLISH_TOKEN_KEY;
    expect(tokenCryptoConfigured()).toBe(false);
  });
});
