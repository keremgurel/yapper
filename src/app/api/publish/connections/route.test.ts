import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/publish", () => ({ listConnections: mocks.list }));
vi.mock("@/lib/publish/tokens", () => ({ tokenCryptoConfigured: () => true }));
beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.list.mockResolvedValue([
    { platform: "facebook", status: "active" },
    { platform: "instagram", status: "active" },
  ]);
});
it("hides retained Facebook connections from old and new clients", async () => {
  const response = await GET();
  const body = await response.json();
  expect(body.connections).toEqual([
    { platform: "instagram", status: "active" },
  ]);
  expect(body.available).not.toContain("facebook");
});
