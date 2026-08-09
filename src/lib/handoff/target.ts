/** Where a phone handoff is allowed to land. Recording is the only reason this
 * exists today, but the prompter and the bank are the obvious next two. */
const ALLOWED_PREFIXES = [
  "/studio/recorder",
  "/studio/ideas",
  "/studio/library",
];

const FALLBACK = "/studio/recorder";

/** Control characters can truncate a Location header or split it into a second
 * one, so a target carrying any of them is not a path we will honour. */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Validate the destination carried in a handoff link.
 *
 * The handoff URL is a bearer credential: it hands whoever opens it a signed-in
 * session. If the destination were free-form, that link would also be an open
 * redirect, and anyone who got the creator to scan a doctored QR could land
 * them on another origin while holding a live session. So the target is checked
 * against an allowlist of our own paths rather than merely being "relative".
 *
 * Each rejection below is a way a string can look relative without being it:
 * an absolute URL, a protocol-relative `//host` (which browsers treat as
 * cross-origin), a backslash (normalised to a slash by some parsers), and any
 * path outside the allowlist.
 */
export function safeHandoffTarget(value: unknown): string {
  if (typeof value !== "string") return FALLBACK;

  const target = value.trim();
  if (!target.startsWith("/")) return FALLBACK;
  if (target.startsWith("//")) return FALLBACK;
  if (target.includes("\\")) return FALLBACK;
  if (CONTROL_CHARS.test(target)) return FALLBACK;

  const path = target.split(/[?#]/)[0];
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  return allowed ? target : FALLBACK;
}
