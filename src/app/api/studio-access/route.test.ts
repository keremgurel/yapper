import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ redeem: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/db/studio-beta", () => ({ redeemBetaAccess: mocks.redeem }));
vi.mock("@/lib/public-rate-limit", () => ({
  guardStudioAccessIp: mocks.limit,
}));

import { hasStudioAccess } from "@/lib/studio-access";
import { hashAccessCode } from "@/lib/studio-beta/access-code";
import { readTesterCookie } from "@/lib/studio-beta/tester-cookie";
import { POST } from "./route";

const ID = "3f0e9c1a-7b2d-4e5f-8a6b-1c2d3e4f5a6b";
const post = (body: unknown) =>
  POST(
    new NextRequest("https://yapper.test/api/studio-access", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const cookieOf = (response: Response) =>
  /yapper_studio_access=([^;]+)/.exec(
    response.headers.get("set-cookie") ?? "",
  )?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STUDIO_ACCESS_PASSWORD", "team-secret");
  mocks.limit.mockResolvedValue(null);
  mocks.redeem.mockResolvedValue({ id: ID });
});

describe("POST /api/studio-access", () => {
  it("gives an approved tester a cookie the gate accepts", async () => {
    const response = await post({
      email: " Maya@Example.com ",
      code: "k7qm 2hxp 9rtd",
    });
    expect(response.status).toBe(200);
    expect(mocks.redeem).toHaveBeenCalledWith(
      "maya@example.com",
      await hashAccessCode("maya@example.com", "K7QM-2HXP-9RTD"),
    );
    const cookie = cookieOf(response);
    expect(await readTesterCookie("team-secret", cookie)).toBe(ID);
    expect(await hasStudioAccess(cookie)).toBe(true);
  });

  it("refuses a wrong code or an unapproved email without saying which", async () => {
    mocks.redeem.mockResolvedValue(null);
    const response = await post({ email: "a@b.co", code: "AAAA-BBBB-CCCC" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "wrong_code" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not look anything up for an empty email or code", async () => {
    expect((await post({ email: " ", code: "AAAA" })).status).toBe(401);
    expect((await post({ email: "a@b.co", code: " " })).status).toBe(401);
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("still accepts the team password", async () => {
    const response = await post({ password: "team-secret" });
    expect(response.status).toBe(200);
    expect(await hasStudioAccess(cookieOf(response))).toBe(true);
    expect((await post({ password: "wrong" })).status).toBe(401);
  });

  it("is rate limited before anything is checked", async () => {
    mocks.limit.mockResolvedValue(new Response(null, { status: 429 }));
    expect((await post({ email: "a@b.co", code: "AAAA" })).status).toBe(429);
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("does not exist when the gate is off", async () => {
    vi.stubEnv("STUDIO_ACCESS_PASSWORD", "");
    expect((await post({ password: "x" })).status).toBe(404);
  });
});
