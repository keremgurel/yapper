import { beforeEach, expect, it, vi } from "vitest";
import {
  getConnectionRow,
  markConnectionExpired,
  updateAccessToken,
} from "@/lib/db/publish";
import { refreshAccessToken } from "./oauth";
import { getFreshAccessToken } from "./connection";
vi.mock("@/lib/db/publish", () => ({
  getConnectionRow: vi.fn(),
  markConnectionExpired: vi.fn(),
  updateAccessToken: vi.fn(),
}));
vi.mock("./oauth", () => ({ refreshAccessToken: vi.fn() }));
vi.mock("./tokens", () => ({
  decryptToken: (value: string) => `decrypted:${value}`,
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getConnectionRow).mockResolvedValue({
    id: "connection",
    userId: "user",
    platform: "youtube",
    externalAccountId: "original",
    handle: "Original",
    accessTokenEnc: "old",
    refreshTokenEnc: "refresh",
    expiresAt: new Date(0),
    status: "active",
    scope: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  vi.mocked(refreshAccessToken).mockResolvedValue({
    accessToken: "fresh",
    refreshToken: "rotated",
    expiresAt: new Date(Date.now() + 3600_000),
  });
  vi.mocked(updateAccessToken).mockResolvedValue(true);
});
it("rejects a different account before reading or refreshing its token", async () => {
  await expect(
    getFreshAccessToken("user", "youtube", "different"),
  ).rejects.toThrow("youtube_account_changed");
  expect(refreshAccessToken).not.toHaveBeenCalled();
});
it("conditions token replacement on the exact connection that was refreshed", async () => {
  expect(await getFreshAccessToken("user", "youtube", "original")).toBe(
    "fresh",
  );
  expect(updateAccessToken).toHaveBeenCalledWith(
    "user",
    "youtube",
    "fresh",
    expect.any(Date),
    "rotated",
    { id: "connection", accessTokenEnc: "old" },
  );
});
it("stops if reconnecting changed the connection while refresh was in flight", async () => {
  vi.mocked(updateAccessToken).mockResolvedValue(false);
  await expect(
    getFreshAccessToken("user", "youtube", "original"),
  ).rejects.toThrow("youtube_connection_changed");
});
it("uses a login another request saved when TikTok refuses a spent refresh token", async () => {
  const row = await getConnectionRow("user", "tiktok");
  vi.mocked(getConnectionRow)
    .mockResolvedValueOnce({ ...row!, platform: "tiktok" })
    .mockResolvedValueOnce({
      ...row!,
      platform: "tiktok",
      accessTokenEnc: "saved-by-the-other-request",
    });
  vi.mocked(refreshAccessToken).mockRejectedValue(
    new Error("oauth_refresh_invalid_grant"),
  );
  expect(await getFreshAccessToken("user", "tiktok")).toBe(
    "decrypted:saved-by-the-other-request",
  );
  expect(markConnectionExpired).not.toHaveBeenCalled();
});
it("marks the login expired when the refusal was not a race", async () => {
  vi.mocked(refreshAccessToken).mockRejectedValue(
    new Error("oauth_refresh_invalid_grant"),
  );
  await expect(getFreshAccessToken("user", "tiktok")).rejects.toThrow(
    "tiktok_reauth_required",
  );
  expect(markConnectionExpired).toHaveBeenCalledWith("user", "tiktok");
});
