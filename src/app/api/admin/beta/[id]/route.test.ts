import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  approve: vi.fn(),
  close: vi.fn(),
  invited: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/studio-beta", () => ({
  findBetaApplication: mocks.find,
  approveBetaApplication: mocks.approve,
  closeBetaApplication: mocks.close,
  markBetaInvited: mocks.invited,
}));
vi.mock("@/lib/studio-beta/send-invite", () => ({
  sendBetaInvite: mocks.send,
}));

import { hashAccessCode } from "@/lib/studio-beta/access-code";
import { POST } from "./route";

const ID = "3f0e9c1a-7b2d-4e5f-8a6b-1c2d3e4f5a6b";
const call = (action: unknown, id = ID) =>
  POST(
    new Request(`https://yapper.test/api/admin/beta/${id}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_USER_IDS", "admin_1");
  mocks.auth.mockResolvedValue({ userId: "admin_1" });
  mocks.find.mockResolvedValue({
    id: ID,
    email: "maya@example.com",
    name: "Maya",
    status: "pending",
  });
  mocks.send.mockResolvedValue({ sent: true });
});

describe("deciding a beta application", () => {
  it("is invisible to anyone who is not an admin", async () => {
    mocks.auth.mockResolvedValue({ userId: "someone_else" });
    expect((await call("approve")).status).toBe(404);
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await call("approve")).status).toBe(404);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("approves, stores only the hash of the code, and emails the invitation", async () => {
    const response = await call("approve");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, emailed: true, emailProblem: null });
    expect(body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(mocks.approve).toHaveBeenCalledWith(
      ID,
      "admin_1",
      await hashAccessCode("maya@example.com", body.code),
    );
    expect(mocks.send).toHaveBeenCalledWith({
      email: "maya@example.com",
      name: "Maya",
      code: body.code,
    });
    expect(mocks.invited).toHaveBeenCalledWith(ID);
  });

  it("still approves and hands back the code when email is not set up", async () => {
    mocks.send.mockResolvedValue({ sent: false, reason: "not_configured" });
    const body = await (await call("approve")).json();
    expect(body).toMatchObject({
      ok: true,
      emailed: false,
      emailProblem: "not_configured",
    });
    expect(body.code).toBeTruthy();
    expect(mocks.invited).not.toHaveBeenCalled();
  });

  it("declines and revokes without issuing a code", async () => {
    expect(await (await call("reject")).json()).toEqual({ ok: true });
    expect(mocks.close).toHaveBeenCalledWith(ID, "admin_1", "rejected");
    await call("revoke");
    expect(mocks.close).toHaveBeenCalledWith(ID, "admin_1", "revoked");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses an unknown action, a malformed id and a missing application", async () => {
    expect((await call("delete")).status).toBe(400);
    expect((await call("approve", "not-a-uuid")).status).toBe(404);
    mocks.find.mockResolvedValue(null);
    expect((await call("approve")).status).toBe(404);
  });
});
