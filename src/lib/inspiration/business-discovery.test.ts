import { beforeEach, describe, expect, it, vi } from "vitest";
import { facebookRequest } from "@/lib/publish/facebook-api";
import {
  fetchBusinessDiscovery,
  linkedInstagramId,
} from "@/lib/inspiration/business-discovery";

vi.mock("@/lib/publish/facebook-api", () => ({ facebookRequest: vi.fn() }));
const request = vi.mocked(facebookRequest);

beforeEach(() => request.mockReset());

describe("linkedInstagramId", () => {
  const pages = {
    data: [
      { id: "1" },
      { id: "2", instagram_business_account: { id: "1784002" } },
      { id: "3", instagram_business_account: { id: "1784003" } },
    ],
  };

  it("prefers the Instagram account linked to the selected Page", async () => {
    request.mockResolvedValueOnce(pages);
    await expect(linkedInstagramId("user-token", "3")).resolves.toBe("1784003");
    expect(request.mock.calls[0][0]).toMatch(/^me\/accounts\?/);
    expect(request.mock.calls[0][1]).toBe("user-token");
  });

  it("uses any linked account when the selected Page has none", async () => {
    request.mockResolvedValueOnce(pages);
    await expect(linkedInstagramId("t", "1")).resolves.toBe("1784002");
  });

  it("throws when no Page has an Instagram account", async () => {
    request.mockResolvedValueOnce({ data: [{ id: "1" }] });
    await expect(linkedInstagramId("t", null)).rejects.toThrow(
      "no_linked_instagram",
    );
  });
});

describe("fetchBusinessDiscovery", () => {
  it("asks for the target's media on the user's IG account", async () => {
    request.mockResolvedValueOnce({
      business_discovery: {
        name: "Creator",
        media: { data: [{ permalink: "p", view_count: 9 }] },
      },
    });
    const scrape = await fetchBusinessDiscovery(
      "1784002",
      "t",
      "some.creator",
      "https://www.instagram.com/some.creator/",
      24,
    );
    const path = request.mock.calls[0][0];
    expect(path.startsWith("1784002?")).toBe(true);
    const fields = new URLSearchParams(path.split("?")[1]).get("fields");
    expect(fields).toContain("business_discovery.username(some.creator)");
    expect(fields).toContain("media.limit(24)");
    expect(fields).toContain("view_count");
    expect(scrape).toEqual({
      name: "Creator",
      avatar: undefined,
      videos: [expect.objectContaining({ url: "p", views: 9 })],
    });
  });

  it("refuses a username that could alter the field expansion", async () => {
    await expect(
      fetchBusinessDiscovery("1", "t", "x){id}", "u", 24),
    ).rejects.toThrow("invalid_username");
    expect(request).not.toHaveBeenCalled();
  });

  it("throws when Meta returns no discovery object", async () => {
    request.mockResolvedValueOnce({});
    await expect(
      fetchBusinessDiscovery("1", "t", "creator", "u", 24),
    ).rejects.toThrow("no_business_discovery");
  });
});
