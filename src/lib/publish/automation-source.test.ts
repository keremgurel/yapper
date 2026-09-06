import { afterEach, expect, it, vi } from "vitest";
import { listAutomationSourcePage } from "./automation-source";
afterEach(() => vi.unstubAllGlobals());
const signal = new AbortController().signal;
it("uses only the fixed Graph endpoint and an opaque cursor, keeping video captions and timestamps", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      data: [
        {
          id: "video",
          media_type: "VIDEO",
          caption: "Full caption\n#tags",
          timestamp: "2026-09-05T12:00:00Z",
          permalink: "https://instagram.com/reel/example",
        },
        { id: "photo", media_type: "IMAGE" },
      ],
      paging: {
        next: "https://untrusted.invalid/ignored",
        cursors: { after: "next_cursor" },
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await listAutomationSourcePage(
    "token",
    "opaque/+cursor",
    signal,
  );
  expect(result.posts).toHaveLength(1);
  expect(result.posts[0].caption).toBe("Full caption\n#tags");
  expect(result.cursor).toBe("next_cursor");
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.origin).toBe("https://graph.instagram.com");
  expect(url.pathname).toBe("/v21.0/me/media");
  expect(url.searchParams.get("after")).toBe("opaque/+cursor");
});
it("does not turn malformed provider output into a completed empty scan", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: {} })),
  );
  await expect(listAutomationSourcePage("token", null, signal)).rejects.toThrow(
    "instagram_check_failed",
  );
});
it("rejects an unadvanceable page and allows restarting an expired cursor", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        data: [],
        paging: { next: "next", cursors: { after: "same" } },
      }),
    )
    .mockResolvedValueOnce(Response.json({ error: {} }, { status: 400 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    listAutomationSourcePage("token", "same", signal),
  ).rejects.toThrow("instagram_cursor_expired");
  await expect(
    listAutomationSourcePage("token", "expired", signal),
  ).rejects.toThrow("instagram_cursor_expired");
});
