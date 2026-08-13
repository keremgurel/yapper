import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  preflight: vi.fn(),
  ingress: vi.fn(),
  spend: vi.fn(),
  fetchCreatorFeed: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflight,
  reservePaidActionOrResponse: vi.fn(),
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
