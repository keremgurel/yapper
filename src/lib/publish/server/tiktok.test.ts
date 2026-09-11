import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishTikTok } from "./tiktok";
import { createPublishWorkflow } from "../workflow";
import { fetchTikTokPostStatus, uploadTikTokDraft } from "../tiktok";
import {
  claimPublishJob,
  completePublishJob,
  failPublishJob,
  findPublishJobClaim,
  recordTikTokPublishId,
} from "@/lib/db/publish";
import { getFreshAccessToken } from "../connection";
import { getObjectFile } from "@/lib/r2";

vi.mock("@/lib/db/publish", () => ({
  claimPublishJob: vi.fn(),
  completePublishJob: vi.fn(),
  failPublishJob: vi.fn(),
  findPublishJobClaim: vi.fn(),
  recordTikTokPublishId: vi.fn(),
  notePublishJobPending: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../connection", () => ({
  getFreshAccessToken: vi.fn(),
  NoConnectionError: class extends Error {},
}));
vi.mock("../media", () => ({
  resolveOwnedMediaKey: vi
    .fn()
    .mockResolvedValue({ ok: true, mediaKey: "owned.mp4" }),
}));
vi.mock("../tiktok", async (original) => ({
  ...(await original<typeof import("../tiktok")>()),
  fetchTikTokPostStatus: vi.fn(),
  uploadTikTokDraft: vi.fn(),
}));
vi.mock("@/lib/r2", () => ({
  r2Configured: () => true,
  getObjectFile: vi.fn(),
}));

function run() {
  const request = new Request("https://ypr.app/api/publish/tiktok", {
    method: "POST",
    headers: {
      "Idempotency-Key": "same_attempt_1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mediaKey: "owned.mp4" }),
  });
  return publishTikTok(request, "owner", createPublishWorkflow(request.signal));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findPublishJobClaim).mockResolvedValue(null);
  vi.mocked(claimPublishJob).mockResolvedValue({
    kind: "created",
    jobId: "job-1",
  });
  vi.mocked(getFreshAccessToken).mockResolvedValue("token");
  vi.mocked(getObjectFile).mockResolvedValue({
    filePath: "/tmp/video.mp4",
    contentType: "video/mp4",
    byteLength: 4,
    cleanup: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(uploadTikTokDraft).mockImplementation(async (input) => {
    await input.onInitialized?.("publish-1");
    return { publishId: "publish-1" };
  });
  vi.mocked(completePublishJob).mockResolvedValue(undefined);
});

describe("TikTok delivery boundary", () => {
  it("does not call accepted bytes a delivered draft", async () => {
    vi.mocked(fetchTikTokPostStatus).mockResolvedValue({
      status: "PROCESSING_UPLOAD",
      uploaded_bytes: 4,
    });
    const response = await run();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "publish_state_pending",
      reconcilable: true,
    });
    expect(recordTikTokPublishId).toHaveBeenCalledWith("job-1", "publish-1");
    expect(completePublishJob).not.toHaveBeenCalled();
    expect(failPublishJob).not.toHaveBeenCalled();
  });

  it.each(["uploading", "published"] as const)(
    "reconciles a %s attempt without uploading again",
    async (status) => {
      vi.mocked(findPublishJobClaim).mockResolvedValue({
        kind: "existing",
        jobId: "job-1",
        status,
        externalPostId: "publish-1",
        externalUrl: "",
      });
      vi.mocked(fetchTikTokPostStatus).mockResolvedValue({
        status: "SEND_TO_USER_INBOX",
      });
      const response = await run();
      expect(await response.json()).toMatchObject({
        draft: true,
        publishId: "publish-1",
      });
      expect(uploadTikTokDraft).not.toHaveBeenCalled();
      expect(getObjectFile).not.toHaveBeenCalled();
      expect(completePublishJob).toHaveBeenCalledWith("job-1", {
        externalPostId: "publish-1",
        externalUrl: "",
        draft: true,
      });
    },
  );

  it("surfaces an asynchronous rejection and its exact reason", async () => {
    vi.mocked(fetchTikTokPostStatus).mockResolvedValue({
      status: "FAILED",
      fail_reason: "duration_check_failed",
    });
    const response = await run();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      reason: "duration_check_failed",
    });
    expect(failPublishJob).toHaveBeenCalledWith(
      "job-1",
      "tiktok_duration_check_failed",
    );
    expect(completePublishJob).not.toHaveBeenCalled();
  });

  it("keeps status endpoint outages pending", async () => {
    vi.mocked(fetchTikTokPostStatus).mockRejectedValue(
      new Error("tiktok_status_503"),
    );
    expect((await run()).status).toBe(503);
    expect(failPublishJob).not.toHaveBeenCalled();
    expect(completePublishJob).not.toHaveBeenCalled();
  });

  it("only marks an idea posted when TikTok reports PUBLISH_COMPLETE", async () => {
    vi.mocked(fetchTikTokPostStatus).mockResolvedValue({
      status: "PUBLISH_COMPLETE",
    });
    expect(await (await run()).json()).toMatchObject({ draft: false });
    expect(completePublishJob).toHaveBeenCalledWith("job-1", {
      externalPostId: "publish-1",
      externalUrl: "",
      draft: false,
    });
  });
});
