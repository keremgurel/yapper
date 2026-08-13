import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isActiveR2Object: vi.fn(),
  presignView: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/r2-lifecycle", () => ({
  isActiveR2Object: mocks.isActiveR2Object,
}));
vi.mock("@/lib/r2", () => ({
  ownsKey: (userId: string, key: string) => key.startsWith(`u/${userId}/`),
  presignView: mocks.presignView,
  r2Configured: () => true,
}));

import { GET } from "./route";

describe("GET /api/media/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_a" });
    mocks.presignView.mockResolvedValue("https://signed.example/object");
  });

  it("does not sign an object committed for deletion", async () => {
    mocks.isActiveR2Object.mockResolvedValue(false);

    const response = await GET(
      new Request(
        "https://app.test/api/media/sign?key=u/user_a/deleted.mp4",
      ) as never,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "media_unavailable" });
    expect(mocks.presignView).not.toHaveBeenCalled();
  });

  it("signs an active object", async () => {
    mocks.isActiveR2Object.mockResolvedValue(true);

    const response = await GET(
      new Request(
        "https://app.test/api/media/sign?key=u/user_a/video.mp4",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://signed.example/object",
    });
  });

  it("rejects another user's prefix before lifecycle lookup", async () => {
    const response = await GET(
      new Request(
        "https://app.test/api/media/sign?key=u/user_b/video.mp4",
      ) as never,
    );

    expect(response.status).toBe(403);
    expect(mocks.isActiveR2Object).not.toHaveBeenCalled();
  });
});
