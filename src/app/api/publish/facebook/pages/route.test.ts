import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  row: vi.fn(),
  list: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/publish", () => ({
  getConnectionRow: mocks.row,
  selectFacebookPage: mocks.select,
}));
vi.mock("@/lib/publish/facebook-api", () => ({
  listFacebookPages: mocks.list,
}));
vi.mock("@/lib/publish/tokens", () => ({
  decryptToken: (value: string) => `decrypted:${value}`,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.row.mockResolvedValue({
    id: "connection",
    refreshTokenEnc: "encrypted-user-token",
    externalAccountId: null,
  });
  mocks.list.mockResolvedValue([
    { id: "123", name: "Creator Page", access_token: "secret-page-token" },
  ]);
  mocks.select.mockResolvedValue(true);
});
const select = (pageId: string) =>
  POST(
    new Request("https://ypr.app/api/publish/facebook/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    }),
  );
describe("per-user Facebook Page selection", () => {
  it("never returns a Page or user token to the browser", async () => {
    const data = await (await GET()).json();
    expect(data).toEqual({
      pages: [{ id: "123", name: "Creator Page" }],
      selectedPageId: null,
    });
    expect(mocks.row).toHaveBeenCalledWith("owner", "facebook");
    expect(JSON.stringify(data)).not.toContain("token");
  });
  it("rechecks Page access before storing the selected destination", async () => {
    expect((await select("999")).status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
    expect((await select("123")).status).toBe(200);
    expect(mocks.select).toHaveBeenCalledWith(
      "owner",
      { id: "connection", refreshTokenEnc: "encrypted-user-token" },
      expect.objectContaining({ id: "123", access_token: "secret-page-token" }),
    );
  });
  it("refuses stale connection writes after another OAuth login", async () => {
    mocks.select.mockResolvedValue(false);
    expect((await select("123")).status).toBe(409);
  });
  it("requires a signed-in user", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
    expect((await select("123")).status).toBe(401);
    expect(mocks.row).not.toHaveBeenCalled();
  });
});
