import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishTikTokDirect } from "./tiktok-direct";
import { createPublishWorkflow } from "../workflow";
const mocks = vi.hoisted(() => ({
  prior: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  record: vi.fn(),
  token: vi.fn(),
  status: vi.fn(),
  start: vi.fn(),
  media: vi.fn(),
  creator: vi.fn(),
}));
vi.mock("@/lib/db/publish", () => ({
  findPublishJobClaim: mocks.prior,
  claimPublishJob: mocks.claim,
  completePublishJob: mocks.complete,
  failPublishJob: mocks.fail,
  recordProviderPublishId: mocks.record,
  notePublishJobPending: vi.fn(),
}));
vi.mock("../connection", () => ({
  getFreshAccessToken: mocks.token,
  NoConnectionError: class extends Error {},
}));
vi.mock("../media", () => ({ resolveOwnedMediaKey: mocks.media }));
vi.mock("../media-grant", () => ({
  createTikTokMediaUrl: () => "https://ypr.app/api/tiktok-media/signed",
}));
vi.mock("../video-metadata", () => ({
  readPublishVideoMetadata: async () => ({
    duration: 30,
    width: 1080,
    height: 1920,
  }),
}));
vi.mock("../tiktok-direct", () => ({
  startTikTokDirectPost: mocks.start,
  fetchTikTokCreator: mocks.creator,
}));
vi.mock("../tiktok", async (original) => ({
  ...(await original<typeof import("../tiktok")>()),
  fetchTikTokPostStatus: mocks.status,
}));
const settings = {
  privacy: "SELF_ONLY",
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  discloseCommercial: false,
  ownBrand: false,
  brandedContent: false,
  aiGenerated: false,
  consent: true,
  accountId: "account-1",
};
function run(patch = {}) {
  const request = new Request("https://ypr.app/api/publish/tiktok/direct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "direct_attempt_1",
    },
    body: JSON.stringify({
      mediaKey: "u/owner/video.mp4",
      settings: { ...settings, ...patch },
      caption: "My original video",
    }),
  });
  return publishTikTokDirect(
    request,
    "owner",
    createPublishWorkflow(request.signal),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prior.mockResolvedValue(null);
  mocks.claim.mockResolvedValue({ kind: "created", jobId: "job-1" });
  mocks.token.mockResolvedValue("token");
  mocks.media.mockResolvedValue({ ok: true, mediaKey: "u/owner/video.mp4" });
  mocks.start.mockResolvedValue("publish-1");
  mocks.creator.mockResolvedValue({
    creator_nickname: "Creator",
    creator_username: "creator",
    privacy_level_options: ["SELF_ONLY"],
    comment_disabled: false,
    duet_disabled: false,
    stitch_disabled: false,
    max_video_post_duration_sec: 60,
  });
  mocks.status.mockResolvedValue({ status: "PROCESSING_DOWNLOAD" });
});
describe("TikTok Direct Post delivery", () => {
  it("requires consent before claiming or initiating a post", async () => {
    expect((await run({ consent: false })).status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("binds the post to the reviewed account and keeps processing pending", async () => {
    expect((await run()).status).toBe(503);
    expect(mocks.token).toHaveBeenCalledWith("owner", "tiktok", "account-1");
    expect(mocks.record).toHaveBeenCalledWith(
      "job-1",
      "publish-1",
      expect.objectContaining({ mode: "direct", accountId: "account-1" }),
    );
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("reconciles without another init and links the actual creator", async () => {
    mocks.prior.mockResolvedValue({
      kind: "existing",
      jobId: "job-1",
      status: "uploading",
      externalPostId: "publish-1",
      providerState: {
        mode: "direct",
        accountId: "account-1",
        username: "creator",
      },
    });
    mocks.status.mockResolvedValue({
      status: "PUBLISH_COMPLETE",
      publicaly_available_post_id: ["7664329094208997396"],
    });
    expect(await (await run()).json()).toMatchObject({
      draft: false,
      url: "https://www.tiktok.com/@creator/video/7664329094208997396",
    });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.media).not.toHaveBeenCalled();
  });
  it("does not reinterpret an inbox attempt as a direct post", async () => {
    mocks.prior.mockResolvedValue({
      kind: "existing",
      jobId: "job-1",
      status: "published",
      providerState: { mode: "inbox" },
    });
    expect((await run()).status).toBe(409);
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("preserves TikTok's processing failure reason", async () => {
    mocks.status.mockResolvedValue({
      status: "FAILED",
      fail_reason: "spam_risk_too_many_posts",
    });
    expect(await (await run()).json()).toMatchObject({
      reason: "spam_risk_too_many_posts",
    });
    expect(mocks.fail).toHaveBeenCalledWith(
      "job-1",
      "tiktok_spam_risk_too_many_posts",
    );
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
