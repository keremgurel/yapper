import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ensureUser: vi.fn(),
  getActiveProject: vi.fn(),
  listBrandAssets: vi.fn(),
  presignView: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/brand", () => ({
  listBrandAssets: mocks.listBrandAssets,
}));
vi.mock("@/lib/db/projects", () => ({
  getActiveProject: mocks.getActiveProject,
  updateProject: mocks.updateProject,
}));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));
vi.mock("@/lib/r2", () => ({ presignView: mocks.presignView }));

import { GET, PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.ensureUser.mockResolvedValue(undefined);
  mocks.getActiveProject.mockResolvedValue({
    id: "project_test",
    brandColors: ["#FF7A21", "#151515"],
  });
  mocks.listBrandAssets.mockResolvedValue([
    {
      id: "logo_test",
      mediaKey: "u/user_test/logo.svg",
      name: "Wordmark.svg",
      mimeType: "image/svg+xml",
      mediaBytes: 512,
      isPrimary: true,
    },
  ]);
  mocks.presignView.mockResolvedValue("https://media.example/logo.svg");
  mocks.updateProject.mockResolvedValue({ id: "project_test" });
});

describe("brand API", () => {
  it("returns the ordered palette and signed logo previews", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      colors: ["#FF7A21", "#151515"],
      logos: [
        {
          id: "logo_test",
          name: "Wordmark.svg",
          mimeType: "image/svg+xml",
          mediaBytes: 512,
          isPrimary: true,
          url: "https://media.example/logo.svg",
        },
      ],
    });
  });

  it("normalizes colors before saving them", async () => {
    const response = await PATCH(
      new Request("https://ypr.app/api/brand", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandColors: [" #ff7a21 ", "#FF7A21", "white"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateProject).toHaveBeenCalledWith("user_test", {
      brandColors: ["#FF7A21", "#FFFFFF"],
    });
    expect((await response.json()).colors).toEqual(["#FF7A21", "#FFFFFF"]);
  });

  it.each(
    [["nope"], ["#FF7A21", "#12345"], [null], Array(9).fill("#FFFFFF")].map(
      (colors) => ({ colors }),
    ),
  )(
    "rejects invalid palettes without changing saved colors: %j",
    async ({ colors }) => {
      const response = await PATCH(
        new Request("https://ypr.app/api/brand", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandColors: colors }),
        }),
      );
      expect(response.status).toBe(400);
      expect(mocks.updateProject).not.toHaveBeenCalled();
    },
  );

  it("does not commit colors if logo signing fails", async () => {
    mocks.presignView.mockRejectedValueOnce(new Error("signing_failed"));
    await expect(
      PATCH(
        new Request("https://ypr.app/api/brand", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandColors: ["#000"] }),
        }),
      ),
    ).rejects.toThrow("signing_failed");
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("allows an explicit empty palette while preserving logos", async () => {
    const response = await PATCH(
      new Request("https://ypr.app/api/brand", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandColors: [] }),
      }),
    );
    const kit = await response.json();
    expect(kit.colors).toEqual([]);
    expect(kit.logos).toHaveLength(1);
  });

  it("rejects anonymous access before touching brand data", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.listBrandAssets).not.toHaveBeenCalled();
  });
});
