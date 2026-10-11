import { getConnectionRow } from "@/lib/db/publish";
import { decryptToken } from "@/lib/publish/tokens";

/** What Meta's reference requires of the token for `business_discovery`. The
 * Facebook connection only asks for the Page scopes today, so this stays
 * empty-handed until the login also requests the two Instagram ones. */
export const DISCOVERY_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
] as const;

export interface DiscoveryAccess {
  /** The Facebook user token. The Page token in `accessTokenEnc` is not the
   * token type Business Discovery documents. */
  userToken: string;
  selectedPageId: string | null;
}

/** Whether a stored grant list covers every Business Discovery permission. */
export function grantsDiscovery(scope: string | null | undefined): boolean {
  const granted = new Set((scope ?? "").split(","));
  return DISCOVERY_SCOPES.every((s) => granted.has(s));
}

/**
 * The user's Facebook credentials when they can serve Business Discovery,
 * else null. Decides from the stored grant alone, so a connection without the
 * Instagram scopes never costs a Graph call before the scraper runs.
 */
export async function getDiscoveryAccess(
  userId: string,
): Promise<DiscoveryAccess | null> {
  const row = await getConnectionRow(userId, "facebook");
  if (!row?.refreshTokenEnc || row.status !== "active") return null;
  if (!grantsDiscovery(row.scope)) return null;
  return {
    userToken: decryptToken(row.refreshTokenEnc),
    selectedPageId: row.externalAccountId,
  };
}
