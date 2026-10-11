import { facebookRequest } from "@/lib/publish/facebook-api";
import type { CreatorScrape } from "./apify";
import {
  DISCOVERY_MEDIA_FIELDS,
  discoveryScrape,
} from "./business-discovery-parse";

/** Instagram usernames: letters, digits, dot, underscore, at most 30. Checked
 * before the name is spliced into a Graph field expansion. */
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

interface PageWithInstagram {
  id: string;
  instagram_business_account?: { id?: string };
}

/**
 * The Instagram professional account linked to one of the user's Pages. The
 * selected Page wins when it has one; otherwise any linked account will do,
 * since Business Discovery only needs some account to ask on behalf of.
 */
export async function linkedInstagramId(
  userToken: string,
  selectedPageId: string | null,
): Promise<string> {
  const query = new URLSearchParams({
    fields: "id,instagram_business_account",
    limit: "100",
  });
  const { data } = await facebookRequest<{ data?: PageWithInstagram[] }>(
    `me/accounts?${query}`,
    userToken,
  );
  const linked = (data ?? []).filter((p) =>
    /^\d+$/.test(p.instagram_business_account?.id ?? ""),
  );
  const page = linked.find((p) => p.id === selectedPageId) ?? linked[0];
  if (!page) throw new Error("no_linked_instagram");
  return page.instagram_business_account!.id!;
}

/**
 * A professional account's recent public media through Meta's Business
 * Discovery, asked on behalf of the user's own linked Instagram account.
 * Throws when the target is personal, age-gated or missing, which Meta does
 * not distinguish, so the caller falls back to scraping.
 */
export async function fetchBusinessDiscovery(
  igUserId: string,
  userToken: string,
  username: string,
  profileUrl: string,
  max: number,
): Promise<CreatorScrape> {
  if (!USERNAME.test(username)) throw new Error("invalid_username");
  const fields =
    `business_discovery.username(${username})` +
    `{name,profile_picture_url,media.limit(${max}){${DISCOVERY_MEDIA_FIELDS}}}`;
  const response = await facebookRequest<{ business_discovery?: unknown }>(
    `${igUserId}?${new URLSearchParams({ fields })}`,
    userToken,
  );
  if (!response.business_discovery) throw new Error("no_business_discovery");
  return discoveryScrape(response.business_discovery, profileUrl);
}
