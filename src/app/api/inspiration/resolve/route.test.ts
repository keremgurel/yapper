import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveInstagramMedia: vi.fn(),
  resolveTikTokMedia: vi.fn(),
  resolveMetadata: vi.fn(),
  resolveWebResource: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_test" }),
}));
vi.mock("@/lib/billing/actions", () => ({
  reservePaidActionOrResponse: vi.fn().mockResolvedValue({
    reservation: {
      action: "reference_analysis",
      cost: 2,
      balance: 98,
      usageId: "usage_test",
    },
  }),
  refundCreditReservation: vi.fn(),
}));
vi.mock("@/lib/inspiration/apify", () => ({
  resolveInstagramMedia: mocks.resolveInstagramMedia,
  resolveTikTokMedia: mocks.resolveTikTokMedia,
}));
vi.mock("@/lib/inspiration/oembed", () => ({
  resolveMetadata: mocks.resolveMetadata,
}));
vi.mock("@/lib/inspiration/web-resource", () => ({
  resolveWebResource: mocks.resolveWebResource,
}));
vi.mock("@/lib/inspiration/remote-transcript", () => ({
  transcribeRemoteMedia: vi.fn(),
}));
vi.mock("@/lib/inspiration/youtube-transcript", () => ({
  fetchYoutubeTranscript: vi.fn(),
}));

import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/inspiration/resolve", () => {
  it("falls back to the real Instagram page when media scraping is unavailable", async () => {
    const url = "https://www.instagram.com/p/DLVOmqxM6sv/";
    mocks.resolveInstagramMedia.mockRejectedValue(new Error("apify_402"));
    mocks.resolveMetadata.mockResolvedValue({});
    mocks.resolveWebResource.mockResolvedValue({
      title: "Michel Marcelino on Instagram",
      summary: "The post says the creator earned a 12 on every CELPIP section.",
      referenceType: "web-resource",
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(
      new Request("https://ypr.app/api/inspiration/resolve", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      platform: "instagram",
      title: "Michel Marcelino on Instagram",
      summary: "The post says the creator earned a 12 on every CELPIP section.",
      referenceType: "web-resource",
    });
    expect(mocks.resolveWebResource).toHaveBeenCalledWith(url);
  });
});
