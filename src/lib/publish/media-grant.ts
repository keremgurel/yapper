import { createHmac, timingSafeEqual } from "node:crypto";
/** Short-lived, read-only capability for a single owned media object. */
function sign(value: string): string {
  const key = process.env.PUBLISH_TOKEN_KEY;
  if (!key) throw new Error("publish_token_key_missing");
  return createHmac("sha256", Buffer.from(key, "base64"))
    .update(`tiktok-media:${value}`)
    .digest("base64url");
}
export function createTikTokMediaUrl(mediaKey: string): string {
  const base = process.env.TIKTOK_MEDIA_ORIGIN ?? "https://ypr.app";
  const origin = new URL(base);
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new Error("invalid_tiktok_media_origin");
  const payload = Buffer.from(
    JSON.stringify({ key: mediaKey, expires: Date.now() + 60 * 60_000 }),
  ).toString("base64url");
  return new URL(
    `/api/tiktok-media/${payload}.${sign(payload)}`,
    origin.origin,
  ).toString();
}
export function readTikTokMediaGrant(
  token: string,
  now = Date.now(),
): string | null {
  if (token.length > 2000) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof value.key === "string" &&
      value.key.startsWith("u/") &&
      Number.isSafeInteger(value.expires) &&
      value.expires > now &&
      value.expires <= now + 60 * 60_000
      ? value.key
      : null;
  } catch {
    return null;
  }
}
