/**
 * The cookie an approved tester holds after entering their access code. It
 * names their application and when it expires, signed with the Studio access
 * secret, so the proxy can check it on every request without a database read.
 * Whether that application is still approved is checked separately, by the
 * Studio layout (see tester-status.ts).
 */

const PREFIX = "t1";
const LABEL = "yapper-studio-tester-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${LABEL}:${payload}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintTesterCookie(
  secret: string,
  applicationId: string,
  expiresAt: Date,
): Promise<string> {
  const payload = `${applicationId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${PREFIX}.${payload}.${await sign(secret, payload)}`;
}

/** The application id a valid, unexpired tester cookie belongs to, else null. */
export async function readTesterCookie(
  secret: string,
  value: string | undefined,
  now: Date = new Date(),
): Promise<string | null> {
  const [prefix, applicationId, expires, signature, ...rest] = (
    value ?? ""
  ).split(".");
  if (prefix !== PREFIX || rest.length > 0) return null;
  if (!applicationId || !UUID.test(applicationId) || !signature) return null;
  const seconds = Number(expires);
  if (!Number.isInteger(seconds) || seconds * 1000 <= now.getTime())
    return null;
  const expected = await sign(secret, `${applicationId}.${expires}`);
  return sameString(signature, expected) ? applicationId : null;
}
