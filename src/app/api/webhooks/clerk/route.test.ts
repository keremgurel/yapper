import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  ensure: vi.fn(),
  remove: vi.fn(),
  capture: vi.fn(),
}));
vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: mocks.verify }));
vi.mock("@/lib/db/users", () => ({
  ensureUser: mocks.ensure,
  deleteUser: mocks.remove,
}));
vi.mock("@/lib/analytics/server", () => ({
  captureVerifiedEvent: mocks.capture,
}));
import { POST } from "./route";
beforeEach(() => vi.clearAllMocks());
const request = () =>
  new NextRequest("https://ypr.app/api/webhooks/clerk", { method: "POST" });
it("counts only verified creation, at the original creation time, even after DB provisioning", async () => {
  mocks.ensure.mockResolvedValue({ created: false });
  const data = { id: "user_a", created_at: 1792022400000 };
  mocks.verify.mockResolvedValue({ type: "user.created", data });
  for (let i = 0; i < 2; i++) expect((await POST(request())).status).toBe(200);
  for (const call of mocks.capture.mock.calls)
    expect(call).toEqual([
      "user_a",
      "signup_verified",
      {
        $insert_id: "clerk-signup:user_a",
        verification_source: "clerk_webhook",
      },
      new Date(data.created_at),
    ]);
  mocks.capture.mockClear();
  mocks.verify.mockResolvedValue({ type: "user.updated", data });
  await POST(request());
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("rejects forged webhooks without emitting a signup", async () => {
  mocks.verify.mockRejectedValue(new Error("signature"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.capture).not.toHaveBeenCalled();
});

it("asks Clerk to retry if verified signup delivery fails", async () => {
  mocks.verify.mockResolvedValue({
    type: "user.created",
    data: { id: "user_a", created_at: 1792022400000 },
  });
  mocks.capture.mockRejectedValueOnce(new Error("ingestion unavailable"));
  expect((await POST(request())).status).toBe(500);
  mocks.capture.mockResolvedValueOnce(undefined);
  expect((await POST(request())).status).toBe(200);
});
