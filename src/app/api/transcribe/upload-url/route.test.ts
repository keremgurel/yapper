import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ingress: vi.fn(),
  spend: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.ingress,
  guardProviderSpend: mocks.spend,
}));
vi.mock("@/lib/r2", () => ({
  r2Configured: () => true,
  transcriptionKey: (user: string, id: string) => `u/${user}/asr/${id}.m4a`,
  presignUpload: mocks.sign,
}));
import { POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.ingress.mockResolvedValue(null);
  mocks.spend.mockResolvedValue(null);
  mocks.sign.mockResolvedValue("https://r2.test/put");
});
const request = (body: unknown) =>
  new Request("https://ypr.app/api/transcribe/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
it("issues a bounded batch as one rate-limited upload plan", async () => {
  const response = await POST(request({ sizes: [100, 200, 300] }));
  const body = await response.json();
  expect(body.tickets).toHaveLength(3);
  expect(
    new Set(body.tickets.map((ticket: { key: string }) => ticket.key)).size,
  ).toBe(3);
  expect(mocks.spend).toHaveBeenCalledOnce();
  expect(mocks.sign.mock.calls.map((args) => args[2])).toEqual([100, 200, 300]);
});
it("preserves the legacy one-object response", async () => {
  const response = await POST(request({ bytes: 100 }));
  expect(await response.json()).toMatchObject({
    key: expect.any(String),
    url: "https://r2.test/put",
  });
  expect(mocks.sign.mock.calls[0]?.[1]).toBe("audio/mp4");
});
it("signs a browser recording with its actual media type", async () => {
  const response = await POST(
    request({ bytes: 5_000_000, contentType: "audio/webm;codecs=opus" }),
  );
  expect(response.status).toBe(200);
  expect(mocks.sign).toHaveBeenCalledWith(
    expect.any(String),
    "audio/webm",
    5_000_000,
    900,
  );
});
it.each(["text/html", "", null, 42])(
  "rejects unsupported upload type %s",
  async (contentType) => {
    expect((await POST(request({ bytes: 100, contentType }))).status).toBe(400);
    expect(mocks.sign).not.toHaveBeenCalled();
  },
);
it.each([
  [],
  [0],
  [-1],
  [1.5],
  Array(649).fill(1),
  Array(5).fill(64 * 1024 * 1024),
])("rejects invalid or oversized batches before signing", async (...sizes) => {
  expect((await POST(request({ sizes }))).status).toBe(400);
  expect(mocks.sign).not.toHaveBeenCalled();
});
