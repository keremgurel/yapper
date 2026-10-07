import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  premium: vi.fn(),
  save: vi.fn(),
  after: vi.fn(),
  enrich: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/content/recording-memory", () => ({
  enrichRecording: mocks.enrich,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({ canUsePremium: mocks.premium }));
vi.mock("@/lib/db/editor-projects", () => ({ saveEditorMaster: mocks.save }));
import { POST } from "./route";
const body = {
  projectId: "ab000000-0000-0000-0000-000000000001",
  submissionId: "ab000000-0000-0000-0000-000000000002",
  revision: "a".repeat(64),
  editedAt: Date.now(),
  title: "Edited project",
  transcript: "Hello",
};
const request = (value: unknown) =>
  new Request("https://studio.ypr.app/api/publish/projects", {
    method: "POST",
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.premium.mockResolvedValue(true);
  mocks.save.mockResolvedValue({ id: "saved" });
});
it("requires an authenticated entitled owner", async () => {
  mocks.auth.mockResolvedValueOnce({ userId: null });
  expect((await POST(request(body))).status).toBe(401);
  mocks.premium.mockResolvedValueOnce(false);
  expect((await POST(request(body))).status).toBe(402);
  expect(mocks.save).not.toHaveBeenCalled();
});
it.each([
  null,
  [],
  {},
  { ...body, projectId: "../other" },
  { ...body, submissionId: "other" },
  { ...body, editedAt: Date.now() + 600_000 },
  { ...body, revision: "invalid" },
])("rejects malformed project receipts: %j", async (value) => {
  expect((await POST(request(value))).status).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("uses the session owner and normalizes project identity", async () => {
  expect(
    (
      await POST(
        request({
          ...body,
          projectId: body.projectId.toUpperCase(),
          userId: "other",
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.after).toHaveBeenCalledTimes(1);
  await mocks.after.mock.calls[0][0]();
  expect(mocks.enrich).toHaveBeenCalledWith("owner", "saved");
  expect(mocks.save).toHaveBeenCalledWith("owner", {
    ...body,
    editedAt: new Date(body.editedAt),
  });
});
it.each(["bad_submission", "media_unavailable", "newer_edit_available"])(
  "returns a recoverable conflict for %s",
  async (reason) => {
    mocks.save.mockRejectedValue(new Error(reason));
    const result = await POST(request(body));
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: reason });
  },
);
