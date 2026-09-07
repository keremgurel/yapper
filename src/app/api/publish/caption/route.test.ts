import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
  item: vi.fn(),
  transcript: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "owner" }),
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: async () => null,
  guardProviderSpend: async () => null,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: async () => null,
  reservePaidActionOrResponse: mocks.reserve,
  refundCreditReservation: mocks.refund,
}));
vi.mock("@/lib/brain/context/server", () => ({
  getBrainContextSafe: async () => ({ section: "", used: [] }),
}));
vi.mock("@/lib/db/content", () => ({ getContentItem: mocks.item }));
vi.mock("@/lib/content/recorded-transcript", () => ({
  loadRecordedTranscript: mocks.transcript,
}));
vi.mock("@/lib/publish/caption-style", () => ({
  collectStyleSamples: async () => [],
}));
vi.mock("@/lib/publish/caption", () => ({ generateCaptions: mocks.generate }));
import { POST } from "./route";
const request = (body: object) =>
  new Request("https://ypr.app/api/publish/caption", {
    method: "POST",
    body: JSON.stringify({ title: "ep 11.", ...body }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "test");
  mocks.reserve.mockResolvedValue({ reservation: { balance: 10 } });
  mocks.generate.mockResolvedValue([
    { platform: "youtube", title: "Grounded title", body: "", hashtags: [] },
  ]);
});
describe("caption generation context", () => {
  it("passes the imported transcript and full original caption to title generation", async () => {
    const response = await POST(
      request({
        transcript: "This is the real topic I discuss.",
        sourceCaption: "ep 11.\nFull caption",
        requireTranscript: true,
        titleOnly: true,
        platforms: ["tiktok", "youtube"],
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({
      script: "This is the real topic I discuss.",
      sourceCaption: "ep 11.\nFull caption",
      titleOnly: true,
      platforms: ["youtube"],
    });
  });
  it("refuses missing transcripts before reserving credits", async () => {
    const response = await POST(request({ requireTranscript: true }));
    expect(response.status).toBe(422);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("refunds if reading the video context fails", async () => {
    mocks.item.mockRejectedValue(new Error("database unavailable"));
    expect((await POST(request({ contentItemId: "owned-item" }))).status).toBe(
      502,
    );
    expect(mocks.refund).toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
