import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveInstagramMedia: vi.fn(),
  resolveTikTokMedia: vi.fn(),
  resolveMetadata: vi.fn(),
  resolveWebResource: vi.fn(),
  transcribeRemoteMedia: vi.fn(),
  fetchYoutubeTranscript: vi.fn(),
  refundCreditReservation: vi.fn(),
  getBalance: vi.fn().mockResolvedValue(100),
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
  refundCreditReservation: mocks.refundCreditReservation,
}));
vi.mock("@/lib/db/credits", () => ({ getBalance: mocks.getBalance }));
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
  transcribeRemoteMedia: mocks.transcribeRemoteMedia,
}));
vi.mock("@/lib/inspiration/youtube-transcript", () => ({
  fetchYoutubeTranscript: mocks.fetchYoutubeTranscript,
}));

import { POST } from "./route";

const REEL = "https://www.instagram.com/p/DLVOmqxM6sv/";

const post = (url: string) =>
  POST(
    new Request("https://ypr.app/api/inspiration/resolve", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mocks.getBalance.mockResolvedValue(100);
});

describe("POST /api/inspiration/resolve", () => {
  /**
   * The reference-transcript honesty rule. A Reel we could not hear must not
   * come back dressed as an article: the expansion prompt reads `summary` as
   * "a written resource rather than a video transcript", so a page summary
   * here silently degrades every expansion built on top of it.
   */
  it("reports a video with no transcript instead of downgrading it to a page summary", async () => {
    mocks.resolveInstagramMedia.mockRejectedValue(new Error("apify_402"));
    mocks.resolveMetadata.mockResolvedValue({ title: "A Reel" });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await post(REEL);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      platform: "instagram",
      referenceType: "social-video",
    });
    expect(json.transcript).toBeUndefined();
    expect(json.summary).toBeUndefined();
    // The written-resource path must not run for a video at all.
    expect(mocks.resolveWebResource).not.toHaveBeenCalled();
  });

  /** The billing bug: the old fallback returned normally rather than throwing,
   * so the catch never ran and a failed transcription still cost 2 credits. */
  it("refunds the credit when it could not hear the video", async () => {
    mocks.resolveInstagramMedia.mockRejectedValue(new Error("apify_402"));
    mocks.resolveMetadata.mockResolvedValue({});
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await post(REEL);

    expect(mocks.refundCreditReservation).toHaveBeenCalledWith(
      "user_test",
      expect.objectContaining({ action: "reference_analysis", cost: 2 }),
      "no_analysis_delivered",
    );
    // The refreshed balance is returned, not the pre-refund reservation figure.
    await expect(response.json()).resolves.toMatchObject({ balance: 100 });
  });

  it("charges when a transcript is actually delivered", async () => {
    mocks.resolveInstagramMedia.mockResolvedValue({
      mediaUrl: "https://cdn.example/reel.mp4",
      title: "A Reel",
    });
    mocks.transcribeRemoteMedia.mockResolvedValue("the words they said");
    mocks.resolveMetadata.mockResolvedValue({});
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_test");

    const response = await post(REEL);

    await expect(response.json()).resolves.toMatchObject({
      transcript: "the words they said",
      referenceType: "social-video",
      balance: 98,
    });
    expect(mocks.refundCreditReservation).not.toHaveBeenCalled();
  });

  /** An article is not a failed video. Its summary IS the deliverable, so the
   * written-resource path stays billable. */
  it("charges for a genuine written resource", async () => {
    mocks.resolveWebResource.mockResolvedValue({
      title: "A study on speaking anxiety",
      summary: "The paper reports that rehearsal reduces filler words.",
      referenceType: "web-resource",
    });

    const response = await post("https://example.com/some-article");

    await expect(response.json()).resolves.toMatchObject({
      summary: "The paper reports that rehearsal reduces filler words.",
      balance: 98,
    });
    expect(mocks.refundCreditReservation).not.toHaveBeenCalled();
  });

  it("refunds a creator link, which delivers only metadata", async () => {
    mocks.resolveMetadata.mockResolvedValue({ title: "Someone" });

    await post("https://www.instagram.com/someone/");

    expect(mocks.refundCreditReservation).toHaveBeenCalledWith(
      "user_test",
      expect.anything(),
      "no_analysis_delivered",
    );
  });
});
