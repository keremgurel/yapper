import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  currentUser: vi.fn().mockResolvedValue(null),
}));

import type { NextRequest } from "next/server";
import { GET, PATCH } from "./route";

/** The project brain is per-user and every field is free text the creator
 * wrote, so an anonymous caller must never reach the database. */
describe("project API authentication", () => {
  it("rejects anonymous reads", async () => {
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects anonymous writes", async () => {
    const request = new Request("https://ypr.app/api/project", {
      method: "PATCH",
      body: JSON.stringify({ audience: "anyone" }),
    }) as NextRequest;

    const response = await PATCH(request);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });
});
