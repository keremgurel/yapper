import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  token: vi.fn(),
  json: vi.fn(),
  bytes: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/publish/connection", () => ({
  getFreshAccessToken: mocks.token,
  NoConnectionError: class extends Error {},
}));
vi.mock("@/lib/http/outbound", () => ({
  fetchBoundedJson: mocks.json,
  fetchBoundedResponse: mocks.bytes,
}));
import { GET } from "./route";
const request = () =>
  new Request("https://ypr.app/api/publish/instagram/thumbnail?mediaId=123");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.token.mockResolvedValue("private-token");
  mocks.json.mockResolvedValue({
    response: { ok: true },
    data: { thumbnail_url: "https://scontent.cdninstagram.com/original.jpg" },
  });
  mocks.bytes.mockResolvedValue({
    response: new Response(null, { headers: { "Content-Type": "image/jpeg" } }),
    bytes: new Uint8Array([1, 2, 3]),
  });
});
describe("original Instagram thumbnail", () => {
  it("returns same-origin image bytes using the connected account", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    expect(mocks.token).toHaveBeenCalledWith("owner", "instagram");
    expect(mocks.bytes.mock.calls[0][1].redirect).toBe("error");
  });
  it("requires sign-in", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await GET(request())).status).toBe(401);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("rejects unexpected download hosts", async () => {
    mocks.json.mockResolvedValue({
      response: { ok: true },
      data: { thumbnail_url: "https://localhost/private" },
    });
    expect((await GET(request())).status).toBe(502);
    expect(mocks.bytes).not.toHaveBeenCalled();
  });
  it("does not serve non-image responses", async () => {
    mocks.bytes.mockResolvedValue({
      response: new Response(null, {
        headers: { "Content-Type": "text/html" },
      }),
      bytes: new Uint8Array([1]),
    });
    expect((await GET(request())).status).toBe(502);
  });
});
