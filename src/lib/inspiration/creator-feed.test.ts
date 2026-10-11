import { beforeEach, describe, expect, it, vi } from "vitest";
import { scrapeCreator } from "@/lib/inspiration/apify";
import { getDiscoveryAccess } from "@/lib/inspiration/business-discovery-access";
import {
  fetchBusinessDiscovery,
  linkedInstagramId,
} from "@/lib/inspiration/business-discovery";
import {
  CREATOR_FEED_LIMIT,
  fetchCreatorFeed,
} from "@/lib/inspiration/creator-feed";

vi.mock("@/lib/inspiration/apify", () => ({ scrapeCreator: vi.fn() }));
vi.mock("@/lib/inspiration/business-discovery-access", () => ({
  getDiscoveryAccess: vi.fn(),
}));
vi.mock("@/lib/inspiration/business-discovery", () => ({
  fetchBusinessDiscovery: vi.fn(),
  linkedInstagramId: vi.fn(),
}));
vi.mock("@/lib/inspiration/youtube-data-api", () => ({
  fetchYouTubeCreator: vi.fn(),
}));
vi.mock("@/lib/publish/connection", () => ({ getFreshAccessToken: vi.fn() }));

const scrape = vi.mocked(scrapeCreator);
const access = vi.mocked(getDiscoveryAccess);
const discover = vi.mocked(fetchBusinessDiscovery);
const igId = vi.mocked(linkedInstagramId);

const URL_ = "https://www.instagram.com/creator/";
const scraped = { name: "from apify", videos: [] };
const discovered = { name: "from meta", videos: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  scrape.mockResolvedValue(scraped);
});

describe("fetchCreatorFeed on Instagram", () => {
  it("uses Business Discovery when the Facebook connection allows it", async () => {
    access.mockResolvedValueOnce({ userToken: "ut", selectedPageId: "9" });
    igId.mockResolvedValueOnce("1784");
    discover.mockResolvedValueOnce(discovered);
    await expect(
      fetchCreatorFeed("u1", "instagram", URL_, "creator"),
    ).resolves.toBe(discovered);
    expect(igId).toHaveBeenCalledWith("ut", "9");
    expect(discover).toHaveBeenCalledWith(
      "1784",
      "ut",
      "creator",
      URL_,
      CREATOR_FEED_LIMIT,
    );
    expect(scrape).not.toHaveBeenCalled();
  });

  it("scrapes without a usable Facebook connection", async () => {
    access.mockResolvedValueOnce(null);
    await expect(
      fetchCreatorFeed("u1", "instagram", URL_, "creator"),
    ).resolves.toBe(scraped);
    expect(igId).not.toHaveBeenCalled();
    expect(scrape).toHaveBeenCalledWith(
      "instagram",
      URL_,
      "creator",
      CREATOR_FEED_LIMIT,
    );
  });

  it("scrapes when Meta declines the target", async () => {
    access.mockResolvedValueOnce({ userToken: "ut", selectedPageId: null });
    igId.mockResolvedValueOnce("1784");
    discover.mockRejectedValueOnce(new Error("facebook_110: not found"));
    await expect(
      fetchCreatorFeed("u1", "instagram", URL_, "creator"),
    ).resolves.toBe(scraped);
  });

  it("scrapes when the user has no linked Instagram account", async () => {
    access.mockResolvedValueOnce({ userToken: "ut", selectedPageId: null });
    igId.mockRejectedValueOnce(new Error("no_linked_instagram"));
    await expect(
      fetchCreatorFeed("u1", "instagram", URL_, "creator"),
    ).resolves.toBe(scraped);
    expect(discover).not.toHaveBeenCalled();
  });

  it("skips Business Discovery without a handle", async () => {
    await fetchCreatorFeed("u1", "instagram", URL_, undefined);
    expect(access).not.toHaveBeenCalled();
    expect(scrape).toHaveBeenCalled();
  });
});

describe("fetchCreatorFeed on TikTok", () => {
  it("always scrapes", async () => {
    await fetchCreatorFeed("u1", "tiktok", "https://www.tiktok.com/@a", "a");
    expect(access).not.toHaveBeenCalled();
    expect(scrape).toHaveBeenCalledWith(
      "tiktok",
      "https://www.tiktok.com/@a",
      "a",
      CREATOR_FEED_LIMIT,
    );
  });
});
