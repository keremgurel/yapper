import { beforeEach, describe, expect, it, vi } from "vitest";
import { existingSourceUrls, importContentItems } from "@/lib/db/content";
import { importReferences } from "./import-references";

vi.mock("@/lib/db/content", () => ({
  existingSourceUrls: vi.fn(),
  importContentItems: vi.fn(),
}));
vi.mock("@/lib/db/projects", () => ({
  getActiveProject: vi.fn(async () => ({ id: "project" })),
}));
vi.mock("@/lib/db/users", () => ({ ensureUser: vi.fn() }));

describe("importReferences", () => {
  beforeEach(() => {
    vi.mocked(existingSourceUrls)
      .mockReset()
      .mockResolvedValue(["https://www.instagram.com/reel/OLD/"]);
    vi.mocked(importContentItems)
      .mockReset()
      .mockImplementation(async (_user, items) => items.length);
  });

  it("skips saved, repeated and non-web links and tags each platform", async () => {
    const result = await importReferences("user_1", [
      { url: "https://www.instagram.com/reel/OLD/" },
      { url: "https://www.instagram.com/reel/NEW/", title: "New reel" },
      { url: "https://www.instagram.com/reel/NEW/" },
      { url: "https://www.tiktok.com/@coach/video/123" },
      { url: "ftp://example.com/file" },
    ]);
    expect(result).toEqual({ ok: true, value: { imported: 2, received: 2 } });
    const items = vi.mocked(importContentItems).mock.calls[0][1];
    expect(
      items.map(({ sourceUrl, sourcePlatform, sourceTitle }) => ({
        sourceUrl,
        sourcePlatform,
        sourceTitle,
      })),
    ).toEqual([
      {
        sourceUrl: "https://www.instagram.com/reel/NEW/",
        sourcePlatform: "instagram",
        sourceTitle: "New reel",
      },
      {
        sourceUrl: "https://www.tiktok.com/@coach/video/123",
        sourcePlatform: "tiktok",
        sourceTitle: null,
      },
    ]);
    expect(items[0].sourceClientId).toMatch(/^ig:/);
    expect(items[1].sourceClientId).toMatch(/^tiktok:/);
  });
});
