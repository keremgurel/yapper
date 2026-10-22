import { afterEach, expect, it, vi } from "vitest";
import { revokeGoogleToken } from "./google-revoke";
afterEach(() => vi.unstubAllGlobals());
it("revokes through a bounded POST without exposing the token in the URL", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await revokeGoogleToken("secret-refresh");
  const [url, request] = fetcher.mock.calls[0];
  expect(url).toBe("https://oauth2.googleapis.com/revoke");
  expect(request.method).toBe("POST");
  expect(request.body.get("token")).toBe("secret-refresh");
  expect(request.signal).toBeInstanceOf(AbortSignal);
});
it("treats an already invalid token as revoked", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "invalid_token" }, { status: 400 }),
      ),
  );
  await expect(revokeGoogleToken("old")).resolves.toBeUndefined();
});
it.each([400, 429, 500])(
  "does not hide a provider failure (%s)",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: "unavailable" }, { status })),
    );
    await expect(revokeGoogleToken("retry-me")).rejects.toThrow(
      "google_revocation_failed",
    );
  },
);
it("propagates a network failure so disconnect can retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(revokeGoogleToken("retry-me")).rejects.toThrow("offline");
});
