/**
 * A short, safe word for why a token refresh failed, for the client and the
 * logs. Only our own error codes and a few known shapes come through; any
 * other message is reported as "unknown" so nothing a provider or a library
 * put in an error ever reaches a response.
 */
export function refreshFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (/^oauth_refresh_[a-z0-9_]{1,40}$/i.test(error.message))
    return error.message;
  if (error instanceof SyntaxError) return "oauth_refresh_bad_response";
  if (error.message === "fetch failed") return "oauth_refresh_unreachable";
  return "unknown";
}
