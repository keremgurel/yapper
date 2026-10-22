import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { PLATFORMS } from "@/lib/publish/platforms";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  save: vi.fn(),
  ensure: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/publish", () => ({ upsertConnection: mocks.save }));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensure }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("YOUTUBE_CLIENT_ID", "client");
  vi.stubEnv("YOUTUBE_CLIENT_SECRET", "secret");
  mocks.auth.mockResolvedValue({ userId: "owner" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const fullGrant = {
  access_token: "access",
  refresh_token: "refresh",
  scope: PLATFORMS.youtube.scopes.join(" "),
  expires_in: 3600,
};
function callback(state = "nonce") {
  return GET(
    new Request(
      `https://ypr.app/api/publish/callback/youtube?code=code&state=${state}`,
      {
        headers: { cookie: "publish_state_youtube=nonce" },
      },
    ),
    { params: Promise.resolve({ platform: "youtube" }) },
  );
}
it.each([
  { ...fullGrant, scope: PLATFORMS.youtube.scopes[0] },
  { ...fullGrant, refresh_token: undefined },
])(
  "preserves the existing connection when consent cannot support the integration",
  async (grant) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(grant));
    vi.stubGlobal("fetch", fetcher);
    const response = await callback();
    expect(response.headers.get("location")).toContain(
      "connect_error=exchange_failed",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "publish_state_youtube=;",
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it("preserves the existing connection when channel identification fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(fullGrant))
      .mockResolvedValueOnce(Response.json({ items: [] })),
  );
  const response = await callback();
  expect(response.headers.get("location")).toContain(
    "connect_error=exchange_failed",
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
it("saves a fully authorized, identified connection under the signed-in user", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(fullGrant))
      .mockResolvedValueOnce(
        Response.json({
          items: [{ id: "channel", snippet: { customUrl: "@channel" } }],
        }),
      ),
  );
  const response = await callback();
  expect(response.headers.get("location")).toContain("connected=youtube");
  expect(mocks.save).toHaveBeenCalledWith(
    "owner",
    "youtube",
    expect.objectContaining({
      externalAccountId: "channel",
      handle: "@channel",
      refreshToken: "refresh",
    }),
  );
});
it("does not exchange a code from an invalid OAuth state", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await callback("wrong");
  expect(response.headers.get("location")).toContain(
    "connect_error=invalid_state",
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
