import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  capture: vi.fn(),
  ip: vi.fn(),
  email: vi.fn(),
}));
vi.mock("@/lib/db/studio-beta", () => ({
  createBetaApplication: mocks.create,
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mocks.capture }),
}));
vi.mock("@/lib/public-rate-limit", () => ({
  guardWaitlistIp: mocks.ip,
  guardWaitlistEmail: mocks.email,
}));

import { POST } from "./route";

const apply = (body: unknown) =>
  POST(
    new Request("https://yapper.test/api/studio-beta/apply", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ip.mockResolvedValue(null);
  mocks.email.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ created: true });
});

describe("POST /api/studio-beta/apply", () => {
  it("stores a cleaned application", async () => {
    const response = await apply({
      email: " Maya@Example.com",
      name: "Maya",
      link: "youtube.com/@maya",
      useCase: "Weekly explainers",
    });
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      email: "maya@example.com",
      name: "Maya",
      link: "youtube.com/@maya",
      useCase: "Weekly explainers",
    });
    expect(mocks.capture).toHaveBeenCalledOnce();
  });

  it("answers the same way for an email that already applied", async () => {
    mocks.create.mockResolvedValue({ created: false });
    const response = await apply({ email: "a@b.co", name: "A" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("rejects a bad application before touching the database", async () => {
    expect((await apply({ email: "nope", name: "A" })).status).toBe(400);
    expect((await apply("not json")).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("honors both rate limits", async () => {
    mocks.ip.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await apply({ email: "a@b.co", name: "A" })).status).toBe(429);
    mocks.ip.mockResolvedValue(null);
    mocks.email.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await apply({ email: "a@b.co", name: "A" })).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not leak a database error", async () => {
    mocks.create.mockRejectedValue(new Error("relation does not exist"));
    const response = await apply({ email: "a@b.co", name: "A" });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("relation");
  });
});
