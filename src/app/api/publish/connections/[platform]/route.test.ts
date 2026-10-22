import { beforeEach, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  remove: vi.fn(),
  revoke: vi.fn(),
  decrypt: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/publish", () => ({ deleteConnection: mocks.remove }));
vi.mock("@/lib/publish/oauth/google-revoke", () => ({
  revokeGoogleToken: mocks.revoke,
}));
vi.mock("@/lib/publish/tokens", () => ({ decryptToken: mocks.decrypt }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.decrypt.mockImplementation((value) => `decrypted:${value}`);
  mocks.remove.mockImplementation(async (_user, _platform, beforeDelete) => {
    await beforeDelete?.({
      refreshTokenEnc: "refresh",
      accessTokenEnc: "access",
    });
    return true;
  });
});
function disconnect(platform = "youtube") {
  return DELETE(
    new Request(`https://ypr.app/api/publish/connections/${platform}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ platform }) },
  );
}
it("requires an authenticated owner before touching credentials", async () => {
  mocks.auth.mockResolvedValue({ userId: null });
  expect((await disconnect()).status).toBe(401);
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.revoke).not.toHaveBeenCalled();
});
it("rejects unknown platforms", async () => {
  expect((await disconnect("unknown")).status).toBe(404);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("revokes the owner's refresh token before confirming disconnect", async () => {
  expect(await (await disconnect()).json()).toEqual({ removed: true });
  expect(mocks.remove).toHaveBeenCalledWith(
    "owner",
    "youtube",
    expect.any(Function),
  );
  expect(mocks.revoke).toHaveBeenCalledWith("decrypted:refresh");
});
it("reports provider failure without disclosing credentials", async () => {
  mocks.revoke.mockRejectedValue(new Error("secret provider detail"));
  const response = await disconnect();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "disconnect_failed" });
});
it("does not revoke Google for another platform", async () => {
  expect((await disconnect("instagram")).status).toBe(200);
  expect(mocks.remove).toHaveBeenCalledWith("owner", "instagram", undefined);
  expect(mocks.revoke).not.toHaveBeenCalled();
});
