import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
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
vi.mock("@/lib/publish/thumbnail", () => ({
  generateThumbnail: mocks.generate,
}));
import { POST } from "./route";
const request = () =>
  new Request("https://ypr.app/api/publish/thumbnail", {
    method: "POST",
    body: JSON.stringify({
      prompt: "ep14",
      frame: "frame",
      reference: "reference",
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "configured");
  vi.stubEnv("GEMINI_API_KEY", "");
  mocks.reserve.mockResolvedValue({ reservation: { balance: 10 } });
  mocks.generate.mockResolvedValue("data:image/jpeg;base64,image");
});
afterEach(() => vi.unstubAllEnvs());
it("generates with Surplus alone and passes both attachments", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    image: "data:image/jpeg;base64,image",
    balance: 10,
  });
  expect(mocks.generate).toHaveBeenCalledWith(
    { prompt: "ep14", frame: "frame", reference: "reference" },
    expect.any(AbortSignal),
  );
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("does not reserve credits without a Surplus key", async () => {
  vi.stubEnv("SURPLUS_API_KEY", "");
  expect((await POST(request())).status).toBe(501);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it("refunds provider failures while keeping provider details private", async () => {
  mocks.generate.mockRejectedValue(
    new Error("thumbnail_502", {
      cause: { message: "private provider details" },
    }),
  );
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "generate_failed" });
  expect(mocks.refund).toHaveBeenCalledWith(
    "owner",
    { balance: 10 },
    "thumbnail_502",
  );
});
