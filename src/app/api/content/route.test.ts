import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ensureUser: vi.fn(),
  createContentItem: vi.fn(),
  listContentItems: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));
vi.mock("@/lib/db/content", () => ({
  createContentItem: mocks.createContentItem,
  listContentItems: mocks.listContentItems,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.createContentItem.mockImplementation(
    async (_userId: string, input: Record<string, unknown>) => ({
      id: "content_test",
      ...input,
    }),
  );
});

describe("POST /api/content", () => {
  it("preserves the initial Poster transcription state", async () => {
    const request = new Request("https://ypr.app/api/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Final edit",
        sourceUrl: "yapper://poster-upload",
        transcriptStatus: "pending",
      }),
    }) as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createContentItem).toHaveBeenCalledWith("user_test", {
      title: "Final edit",
      sourceUrl: "yapper://poster-upload",
      transcriptStatus: "pending",
      stage: "library",
    });
    await expect(response.json()).resolves.toMatchObject({
      item: { transcriptStatus: "pending" },
    });
  });
});
