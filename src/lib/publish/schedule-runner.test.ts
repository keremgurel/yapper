import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishingSchedule } from "@/lib/db/publishing-schedules";
import { findPublishJobClaim, getConnectionRow } from "@/lib/db/publish";
import { getContentItem } from "@/lib/db/content";
import { publishYouTube } from "./server/youtube";
import { publishTikTok } from "./server/tiktok";
import { runScheduledDestination } from "./schedule-runner";

vi.mock("@/lib/db/publish", () => ({
  findPublishJobClaim: vi.fn(),
  getConnectionRow: vi.fn(),
}));
vi.mock("@/lib/db/content", () => ({ getContentItem: vi.fn() }));
vi.mock("./server/youtube", () => ({ publishYouTube: vi.fn() }));
vi.mock("./server/instagram", () => ({ publishInstagram: vi.fn() }));
vi.mock("./server/tiktok", () => ({ publishTikTok: vi.fn() }));
const row = (patch: Partial<PublishingSchedule> = {}): PublishingSchedule => ({
  id: randomUUID(),
  userId: "user_test",
  requestKey: randomUUID(),
  requestHash: "reviewed",
  entryIndex: 0,
  platform: "youtube",
  externalAccountId: "original_account",
  accountLabel: "Reviewed account",
  title: "Title",
  contentItemId: null,
  input: { mediaKey: "user_test/video.mp4", title: "Reviewed title" },
  scheduledFor: new Date(),
  timezone: "UTC",
  status: "running",
  attempt: 0,
  leaseToken: randomUUID(),
  leaseExpiresAt: new Date(),
  publishJobId: null,
  error: null,
  externalUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...patch,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findPublishJobClaim).mockResolvedValue(null);
  vi.mocked(getConnectionRow).mockResolvedValue({
    externalAccountId: "original_account",
    status: "active",
  } as Awaited<ReturnType<typeof getConnectionRow>>);
});
const run = (value = row()) =>
  runScheduledDestination(value, new AbortController().signal);
const prior = (status: "processing" | "published" | "failed") => ({
  kind: "existing" as const,
  status,
  jobId: randomUUID(),
  externalUrl: "https://youtu.be/posted",
  externalPostId: "posted",
});

describe("scheduled destination execution", () => {
  it("sends the immutable snapshot with the original account and persistent attempt key", async () => {
    const value = row();
    vi.mocked(publishYouTube).mockResolvedValue(
      Response.json({ jobId: "job", url: "https://youtu.be/posted" }),
    );
    expect(await run(value)).toEqual({
      status: "published",
      publishJobId: "job",
      externalUrl: "https://youtu.be/posted",
    });
    const [request, user, , expectedAccount] =
      vi.mocked(publishYouTube).mock.calls[0];
    expect(request.headers.get("Idempotency-Key")).toBe(
      `schedule:${value.id}:0`,
    );
    expect(await request.json()).toEqual(value.input);
    expect(user).toBe(value.userId);
    expect(expectedAccount).toBe("original_account");
  });
  it("does not send after a different account is connected", async () => {
    vi.mocked(getConnectionRow).mockResolvedValue({
      externalAccountId: "replacement",
      status: "active",
    } as Awaited<ReturnType<typeof getConnectionRow>>);
    expect(await run()).toMatchObject({
      status: "failed",
      error: "destination_account_changed",
    });
    expect(publishYouTube).not.toHaveBeenCalled();
  });
  it("does not send an item deleted since scheduling", async () => {
    vi.mocked(getContentItem).mockResolvedValue(undefined as never);
    expect(
      await run(
        row({
          input: {
            mediaKey: "user_test/video.mp4",
            contentItemId: randomUUID(),
          },
        }),
      ),
    ).toMatchObject({ status: "failed", error: "content_item_unavailable" });
    expect(publishYouTube).not.toHaveBeenCalled();
  });
  it("replays an existing operation even when the account or source changed later", async () => {
    vi.mocked(findPublishJobClaim).mockResolvedValue(prior("published"));
    vi.mocked(publishYouTube).mockResolvedValue(
      Response.json({ jobId: "original", replayed: true }),
    );
    expect(await run()).toMatchObject({
      status: "published",
      publishJobId: "original",
    });
    expect(getConnectionRow).not.toHaveBeenCalled();
  });
  it("reports TikTok as a draft, never a public post", async () => {
    vi.mocked(publishTikTok).mockResolvedValue(
      Response.json({ jobId: "draft", draft: true }),
    );
    expect(await run(row({ platform: "tiktok" }))).toMatchObject({
      status: "draft",
    });
  });
  it.each(["publish_in_progress", "publish_state_pending"])(
    "retains an uncertain outcome for %s without issuing another attempt",
    async (error) => {
      vi.mocked(publishYouTube).mockResolvedValue(
        Response.json({ jobId: "pending", error }, { status: 503 }),
      );
      expect(await run()).toMatchObject({ status: "needs_attention", error });
      expect(publishYouTube).toHaveBeenCalledTimes(1);
    },
  );
  it("rechecks durable state after an exception to distinguish accepted, pending and safe-to-retry work", async () => {
    vi.mocked(publishYouTube).mockRejectedValue(new Error("lost_response"));
    for (const status of ["published", "processing", "failed"] as const) {
      vi.mocked(findPublishJobClaim)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(prior(status));
      expect(await run()).toMatchObject({
        status: status === "processing" ? "needs_attention" : status,
      });
    }
  });
  it("leaves recovery to the lease if durable state cannot be read", async () => {
    vi.mocked(findPublishJobClaim).mockRejectedValue(
      new Error("database_unavailable"),
    );
    await expect(run()).rejects.toThrow("database_unavailable");
    expect(publishYouTube).not.toHaveBeenCalled();
  });
});
