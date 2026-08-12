export const DICTIONARY_OWNER_HEADER = "x-yapper-dictionary-owner";

/**
 * Reject a request that began under a different browser account. The header is
 * only a stale-session assertion; authorization and database ownership still
 * come exclusively from Clerk's server-side user ID.
 */
export function hasExpectedDictionaryOwner(
  request: Request,
  authenticatedUserId: string,
): boolean {
  const expected = request.headers.get(DICTIONARY_OWNER_HEADER);
  // Native uses the same authenticated routes but does not have Clerk's user
  // ID outside its web view. Absence preserves that client; a browser assertion
  // is always sent and a present mismatch is rejected.
  return expected === null || expected === authenticatedUserId;
}
