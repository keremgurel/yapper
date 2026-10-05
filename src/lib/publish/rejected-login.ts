/**
 * Whether a platform refused the saved login for good, as opposed to failing
 * for a moment. A refresh answered with 400 or 401 means the grant was revoked
 * or the password changed; Instagram's Graph code 190 means the session was
 * invalidated. Retrying will not help, so the creator has to reconnect.
 */
export function isRejectedLogin(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { graphCode?: number }).graphCode === 190) return true;
  return /^oauth_refresh_(400|401)$/.test(error.message);
}
