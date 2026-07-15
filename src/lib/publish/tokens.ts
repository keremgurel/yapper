import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption for the platform OAuth tokens we store. Access and refresh tokens
 * grant posting on the user's behalf, so they are never written to the DB in
 * plaintext: AES-256-GCM with a server-only key (PUBLISH_TOKEN_KEY, 32 bytes,
 * base64). GCM is authenticated, so a tampered ciphertext fails to decrypt
 * rather than yielding garbage.
 *
 * Layout of the stored string (base64): [12-byte IV][16-byte tag][ciphertext].
 */
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const raw = process.env.PUBLISH_TOKEN_KEY;
  if (!raw) throw new Error("PUBLISH_TOKEN_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("PUBLISH_TOKEN_KEY must decode to 32 bytes (base64)");
  }
  return buf;
}

/** True when a valid key is configured, so routes can 501 instead of throwing. */
export function tokenCryptoConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  if (buf.length < IV_LEN + TAG_LEN)
    throw new Error("token ciphertext too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}
