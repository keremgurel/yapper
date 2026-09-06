import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import {
  enqueueAutomationRun,
  failAutomationRun,
  finishAutomationScan,
  type AutomationRule,
  type AutomationRun,
} from "@/lib/db/automations";
import { getConnectionRow } from "@/lib/db/publish";
import { canUsePremium } from "@/lib/billing/gate";
import { getFreshAccessToken } from "./connection";
import { listAutomationSourcePage } from "./automation-source";
import { importInstagramVideo } from "./server/instagram-import";
import {
  discoverAutomationPosts,
  prepareAutomationRun,
} from "./automation-runner";
import { DEFAULT_AUTOMATION_SETTINGS as settings } from "./automation-types";
vi.mock("@/lib/db/automations", () => ({
  claimAutomationRules: vi.fn(),
  claimAutomationRuns: vi.fn(),
  enqueueAutomationRun: vi.fn(),
  failAutomationRun: vi.fn(),
  finishAutomationScan: vi.fn(),
}));
vi.mock("@/lib/db/publish", () => ({ getConnectionRow: vi.fn() }));
vi.mock("@/lib/billing/gate", () => ({ canUsePremium: vi.fn() }));
vi.mock("./connection", () => ({ getFreshAccessToken: vi.fn() }));
vi.mock("./automation-source", () => ({ listAutomationSourcePage: vi.fn() }));
vi.mock("./server/instagram-import", () => ({ importInstagramVideo: vi.fn() }));
const signal = new AbortController().signal;
const rule = (): AutomationRule => ({
  id: randomUUID(),
  userId: "user_test",
  version: 1,
  enabled: true,
  settings,
  sourceAccountId: "ig",
  sourceLabel: "Instagram",
  accounts: [{ platform: "youtube", id: "yt", label: "YouTube" }],
  enabledAt: new Date(),
  scanCursor: "tail-page",
  lastCheckedAt: null,
  nextCheckAt: new Date(),
  leaseToken: randomUUID(),
  leaseExpiresAt: new Date(),
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const run = (): AutomationRun => ({
  id: randomUUID(),
  userId: "user_test",
  ruleId: randomUUID(),
  sourceAccountId: "ig",
  sourcePostId: "post",
  sourceUrl: "https://instagram.com/reel/post",
  title: "Post",
  caption: "Caption",
  settings,
  accounts: [{ platform: "youtube", id: "yt", label: "YouTube" }],
  status: "importing",
  leaseToken: randomUUID(),
  leaseExpiresAt: new Date(),
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(canUsePremium).mockResolvedValue(true);
  vi.mocked(getFreshAccessToken).mockResolvedValue("token");
  vi.mocked(finishAutomationScan).mockResolvedValue(1);
  vi.mocked(getConnectionRow).mockImplementation(
    async (_user, platform) =>
      ({
        externalAccountId: platform === "instagram" ? "ig" : "yt",
        status: "active",
      }) as Awaited<ReturnType<typeof getConnectionRow>>,
  );
  vi.mocked(importInstagramVideo).mockResolvedValue(
    Response.json({ mediaKey: "user_test/import.mp4" }),
  );
  vi.mocked(enqueueAutomationRun).mockResolvedValue(true);
});
it("checks the newest page while continuing the durable older-page cursor", async () => {
  const value = rule();
  const head = {
    id: "head",
    caption: "Head",
    url: "",
    publishedAt: new Date().toISOString(),
  };
  const tail = { ...head, id: "tail" };
  vi.mocked(listAutomationSourcePage)
    .mockResolvedValueOnce({ posts: [head], cursor: "head-next" })
    .mockResolvedValueOnce({ posts: [tail], cursor: "tail-next" });
  await discoverAutomationPosts(value, signal);
  expect(getFreshAccessToken).toHaveBeenCalledWith(
    "user_test",
    "instagram",
    "ig",
  );
  expect(listAutomationSourcePage).toHaveBeenNthCalledWith(
    1,
    "token",
    null,
    signal,
  );
  expect(listAutomationSourcePage).toHaveBeenNthCalledWith(
    2,
    "token",
    "tail-page",
    signal,
  );
  expect(finishAutomationScan).toHaveBeenCalledWith(value, {
    posts: [head, tail],
    cursor: "tail-next",
  });
});
it("keeps failed scans visible and restarts only an expired cursor", async () => {
  const value = rule();
  vi.mocked(listAutomationSourcePage).mockRejectedValueOnce(
    new Error("instagram_check_failed"),
  );
  await discoverAutomationPosts(value, signal);
  expect(finishAutomationScan).toHaveBeenLastCalledWith(value, {
    posts: [],
    cursor: "tail-page",
    error: "instagram_check_failed",
  });
  vi.mocked(listAutomationSourcePage).mockRejectedValueOnce(
    new Error("instagram_cursor_expired"),
  );
  await discoverAutomationPosts(value, signal);
  expect(finishAutomationScan).toHaveBeenLastCalledWith(value, {
    posts: [],
    cursor: null,
    error: "instagram_cursor_expired",
  });
});
it("does not poll a paid provider without the required entitlement", async () => {
  vi.mocked(canUsePremium).mockResolvedValue(false);
  const value = rule();
  await discoverAutomationPosts(value, signal);
  expect(getFreshAccessToken).not.toHaveBeenCalled();
  expect(finishAutomationScan).toHaveBeenCalledWith(
    value,
    expect.objectContaining({ error: "not_entitled" }),
  );
});
it("imports as the actual owner, then enqueues its reviewed destinations", async () => {
  const value = run();
  expect(await prepareAutomationRun(value, signal)).toBe(true);
  const [request, owner, account, background] =
    vi.mocked(importInstagramVideo).mock.calls[0];
  expect(owner).toBe("user_test");
  expect(account).toBe("ig");
  expect(background).toBe(true);
  expect(await request.json()).toEqual({ mediaId: "post" });
  expect(enqueueAutomationRun).toHaveBeenCalledWith(
    value,
    "user_test/import.mp4",
  );
});
it("stops before importing when a reviewed account changes", async () => {
  vi.mocked(getConnectionRow).mockResolvedValue({
    externalAccountId: "replacement",
    status: "active",
  } as Awaited<ReturnType<typeof getConnectionRow>>);
  const value = run();
  expect(await prepareAutomationRun(value, signal)).toBe(false);
  expect(importInstagramVideo).not.toHaveBeenCalled();
  expect(enqueueAutomationRun).not.toHaveBeenCalled();
  expect(failAutomationRun).toHaveBeenCalledWith(
    value,
    "source_account_changed",
  );
});
it("keeps a missing-source failure recoverable without queuing a fake successful post", async () => {
  vi.mocked(importInstagramVideo).mockResolvedValue(
    Response.json({ error: "no_source_file" }, { status: 422 }),
  );
  const value = run();
  expect(await prepareAutomationRun(value, signal)).toBe(false);
  expect(enqueueAutomationRun).not.toHaveBeenCalled();
  expect(failAutomationRun).toHaveBeenCalledWith(value, "no_source_file");
});
it("leaves a deferred lease if the error itself cannot be saved", async () => {
  vi.mocked(importInstagramVideo).mockRejectedValue(new Error("import_failed"));
  vi.mocked(failAutomationRun).mockRejectedValue(
    new Error("database_unavailable"),
  );
  await expect(prepareAutomationRun(run(), signal)).rejects.toThrow(
    "database_unavailable",
  );
});
