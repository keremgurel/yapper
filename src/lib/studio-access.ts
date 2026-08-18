/**
 * A shared password in front of Studio, on top of Clerk.
 *
 * Clerk answers "who are you"; this answers "should anyone outside the team be
 * in here at all yet". Studio is not finished, but the marketing site and the
 * training tools around it are live and take payment, so the whole deployment
 * cannot sit behind Vercel's project-level protection.
 *
 * The cookie never carries the password. It carries an HMAC over a fixed label
 * keyed by the password, so a stolen cookie reveals nothing and rotating the
 * password invalidates every outstanding cookie at once.
 */

export const STUDIO_ACCESS_COOKIE = "yapper_studio_access";

/** 30 days: long enough that a tester signs in once a month, short enough that
 * a forgotten laptop stops working on its own. */
export const STUDIO_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_LABEL = "yapper-studio-access-v1";

/** The gate is off entirely when no password is configured, so local dev and
 * preview builds behave exactly as they did before. */
export function studioAccessPassword(): string | null {
  const value = process.env.STUDIO_ACCESS_PASSWORD?.trim();
  return value ? value : null;
}

export function isStudioAccessEnabled(): boolean {
  return studioAccessPassword() !== null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Web Crypto rather than node:crypto: the proxy runs this on every Studio
 * request and must not depend on which runtime Next chooses for it.
 */
export async function studioAccessToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(TOKEN_LABEL),
  );
  return toHex(signature);
}

/** Length-independent, constant-time comparison of two hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** True when the presented cookie was minted from the current password. */
export async function hasStudioAccess(
  cookieValue: string | undefined,
): Promise<boolean> {
  const password = studioAccessPassword();
  if (!password) return true;
  if (!cookieValue) return false;
  const expected = await studioAccessToken(password);
  return timingSafeEqual(cookieValue, expected);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toHex(digest);
}

/**
 * True when the submitted password is the configured one. Both sides are
 * hashed first, so the comparison runs over two fixed-length digests and its
 * timing never depends on how much of the real password was guessed.
 */
export async function isStudioPasswordCorrect(
  submitted: string,
): Promise<boolean> {
  const password = studioAccessPassword();
  if (!password) return true;
  const [a, b] = await Promise.all([sha256Hex(submitted), sha256Hex(password)]);
  return timingSafeEqual(a, b);
}
