import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createSignInToken: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: vi.fn(async () => ({
    signInTokens: { createSignInToken: mocks.createSignInToken },
  })),
}));

import { GET } from "./route";

const state = "12345678-1234-1234-1234-123456789abc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_selected" });
  mocks.createSignInToken.mockResolvedValue({ token: "ticket_selected" });
});

describe("GET /studio/native-auth/ticket", () => {
  it("returns a private, short-lived ticket for the authenticated account", async () => {
    const response = await GET(
      new Request(`https://ypr.app/studio/native-auth/ticket?state=${state}`),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBe(
      `yapper-studio://auth/callback?ticket=ticket_selected&state=${state}`,
    );
    expect(mocks.createSignInToken).toHaveBeenCalledWith({
      userId: "user_selected",
      expiresInSeconds: 60,
    });
  });

  it("does not mint a ticket for an invalid state", async () => {
    const response = await GET(
      new Request("https://ypr.app/studio/native-auth/ticket?state=invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.createSignInToken).not.toHaveBeenCalled();
  });

  it("does not mint a ticket while signed out", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await GET(
      new Request(`https://ypr.app/studio/native-auth/ticket?state=${state}`),
    );

    expect(response.status).toBe(302);
    expect(mocks.createSignInToken).not.toHaveBeenCalled();
  });
});
