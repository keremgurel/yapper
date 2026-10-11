import { beforeEach, describe, expect, it, vi } from "vitest";
import { getConnectionRow } from "@/lib/db/publish";
import {
  getDiscoveryAccess,
  grantsDiscovery,
} from "@/lib/inspiration/business-discovery-access";

vi.mock("@/lib/db/publish", () => ({ getConnectionRow: vi.fn() }));
vi.mock("@/lib/publish/tokens", () => ({
  decryptToken: (v: string) => `plain:${v}`,
}));
const getRow = vi.mocked(getConnectionRow);

const FULL =
  "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_insights";

beforeEach(() => getRow.mockReset());

describe("grantsDiscovery", () => {
  it("needs every Business Discovery permission", () => {
    expect(grantsDiscovery(FULL)).toBe(true);
    // Today's Facebook connection: Page scopes only.
    expect(
      grantsDiscovery(
        "pages_show_list,pages_read_engagement,pages_manage_posts",
      ),
    ).toBe(false);
    expect(grantsDiscovery(null)).toBe(false);
  });
});

describe("getDiscoveryAccess", () => {
  const row = (over: Record<string, unknown>) =>
    ({
      status: "active",
      scope: FULL,
      refreshTokenEnc: "user",
      accessTokenEnc: "page",
      externalAccountId: "42",
      ...over,
    }) as unknown as Awaited<ReturnType<typeof getConnectionRow>>;

  it("returns the Facebook user token, not the Page token", async () => {
    getRow.mockResolvedValueOnce(row({}));
    await expect(getDiscoveryAccess("u1")).resolves.toEqual({
      userToken: "plain:user",
      selectedPageId: "42",
    });
  });

  it("is null without the Instagram scopes", async () => {
    getRow.mockResolvedValueOnce(row({ scope: "pages_show_list" }));
    await expect(getDiscoveryAccess("u1")).resolves.toBeNull();
  });

  it("is null for an expired or missing connection", async () => {
    getRow.mockResolvedValueOnce(row({ status: "expired" }));
    await expect(getDiscoveryAccess("u1")).resolves.toBeNull();
    getRow.mockResolvedValueOnce(row({ refreshTokenEnc: null }));
    await expect(getDiscoveryAccess("u1")).resolves.toBeNull();
  });
});
