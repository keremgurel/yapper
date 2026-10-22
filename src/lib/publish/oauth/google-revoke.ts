/** Revoke the Google project grant, including its refresh token. Never log
 * credentials or put them in URLs. A failed request must remain retryable. */
export async function revokeGoogleToken(token: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return;
  // A previously revoked token has already reached the requested state.
  const body = await response.json().catch(() => null);
  if (response.status === 400 && body?.error === "invalid_token") return;
  throw new Error("google_revocation_failed");
}
