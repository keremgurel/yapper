import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  preflight: vi.fn(),
  ingress: vi.fn(),
  spend: vi.fn(),
  fetchCreatorFeed: vi.fn(),
  reserve: vi.fn(),
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflight,
  reservePaidActionOrResponse: mocks.reserve,
  refundCreditReservation: vi.fn(),
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.ingress,
  guardProviderSpend: mocks.spend,
}));
vi.mock("@/lib/inspiration/creator-feed", () => ({
  CREATOR_FEED_LIMIT: 24,
  fetchCreatorFeed: mocks.fetchCreatorFeed,
}));

vi.mock("@/lib/db/scrape-cache", () => ({
  readScrapeCache: mocks.readCache,
  writeScrapeCache: mocks.writeCache,
}));

import { POST } from "./route";

const post = (url: string) =>
  POST(
    new Request("https://ypr.app/api/inspiration/creator", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.ingress.mockResolvedValue(null);
  mocks.preflight.mockResolvedValue(null);
  mocks.spend.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({ reservation: { balance: 5 } });
  mocks.readCache.mockResolvedValue(null);
  mocks.writeCache.mockResolvedValue(undefined);
});

describe("POST /api/inspiration/creator provider availability", () => {
  it("soft-rejects an unsupported platform before billing or spend", async () => {
    const response = await post("https://example.com/creator");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      videos: [],
      error: "unsupported_platform",
    });
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.spend).not.toHaveBeenCalled();
  });

  it("soft-rejects a scraper platform with no scraper token before spend", async () => {
    const response = await post("https://www.instagram.com/example/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      videos: [],
      error: "no_apify_token",
    });
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.spend).not.toHaveBeenCalled();
    expect(mocks.fetchCreatorFeed).not.toHaveBeenCalled();
  });
});

describe("POST /api/inspiration/creator shared feed cache", () => {
  const feed = {
    name: "Someone",
    videos: [
      {
        id: "1",
        url: "https://www.tiktok.com/@someone/video/1",
        title: "A post",
        views: 1000,
      },
    ],
  };

  it("serves a cached feed without scraping again", async () => {
    vi.stubEnv("APIFY_TOKEN", "token");
    mocks.readCache.mockResolvedValue(feed);

    const response = await post("https://www.tiktok.com/@someone?lang=en");

    expect(response.status).toBe(200);
    expect(mocks.readCache).toHaveBeenCalledWith(
      "creator:tiktok:someone",
      expect.any(Number),
    );
    expect(mocks.fetchCreatorFeed).not.toHaveBeenCalled();
    expect(mocks.writeCache).not.toHaveBeenCalled();
  });

  it("scrapes on a miss and stores a non-empty feed", async () => {
    vi.stubEnv("APIFY_TOKEN", "token");
    mocks.fetchCreatorFeed.mockResolvedValue(feed);

    await post("https://www.tiktok.com/@someone");

    expect(mocks.fetchCreatorFeed).toHaveBeenCalledTimes(1);
    expect(mocks.writeCache).toHaveBeenCalledWith(
      "creator:tiktok:someone",
      feed,
    );
  });

  it("never reads or writes the cache for a YouTube channel", async () => {
    mocks.fetchCreatorFeed.mockResolvedValue(feed);

    await post("https://www.youtube.com/@someone");

    expect(mocks.readCache).toHaveBeenCalledWith(null, expect.any(Number));
    expect(mocks.writeCache).toHaveBeenCalledWith(null, feed);
  });

  it("does not store an empty feed", async () => {
    vi.stubEnv("APIFY_TOKEN", "token");
    mocks.fetchCreatorFeed.mockResolvedValue({ videos: [] });

    await post("https://www.tiktok.com/@someone");

    expect(mocks.writeCache).not.toHaveBeenCalled();
  });
});
