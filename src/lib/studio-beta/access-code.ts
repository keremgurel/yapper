/**
 * A tester's personal access code: three groups of four characters, from an
 * alphabet without the look-alikes (0/O, 1/I/L), so it survives being read off
 * an email and typed. About 59 bits, behind a rate-limited form.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

export function generateAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * GROUP_LENGTH));
  const chars = Array.from(
    bytes,
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
  return (chars.match(new RegExp(`.{${GROUP_LENGTH}}`, "g")) ?? []).join("-");
}

/** What the tester typed, reduced to the characters that count. Dashes, spaces
 * and case are forgiven. */
export function normalizeAccessCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The stored form of a code. Bound to the email it was issued for, so one
 * tester's code is useless with another address, and never reversible.
 */
export async function hashAccessCode(
  email: string,
  code: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `yapper-studio-beta-v1:${email.trim().toLowerCase()}:${normalizeAccessCode(code)}`,
    ),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
