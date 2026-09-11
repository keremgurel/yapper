import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishFacebook } from "./facebook";
import { createPublishWorkflow } from "../workflow";
const mocks = vi.hoisted(() => ({
  prior: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  record: vi.fn(),
  token: vi.fn(),
  status: vi.fn(),
  post: vi.fn(),
  row: vi.fn(),
}));
vi.mock("@/lib/db/publish", () => ({
  findPublishJobClaim: mocks.prior,
  claimPublishJob: mocks.claim,
  completePublishJob: mocks.complete,
  failPublishJob: mocks.fail,
  recordProviderPublishId: mocks.record,
  getConnectionRow: mocks.row,
  notePublishJobPending: vi.fn(),
}));
vi.mock("../connection", () => ({
  getFreshAccessToken: mocks.token,
  NoConnectionError: class extends Error {},
}));
vi.mock("../media", () => ({
  resolveOwnedMediaKey: async () => ({
    ok: true,
    mediaKey: "u/owner/video.mp4",
  }),
}));
vi.mock("../video-metadata", () => ({
  readPublishVideoMetadata: async () => ({
    duration: 30,
    width: 1080,
    height: 1920,
  }),
}));
vi.mock("@/lib/r2", () => ({
  presignView: async () => "https://storage.example/video.mp4",
}));
vi.mock("../facebook", () => ({
  postFacebookReel: mocks.post,
  facebookReelStatus: mocks.status,
}));
function run(expectedAccountId = "123") {
  const request = new Request("https://ypr.app/api/publish/facebook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "facebook_attempt_1",
    },
    body: JSON.stringify({
      mediaKey: "u/owner/video.mp4",
      expectedAccountId,
      caption: "My original video",
    }),
  });
  return publishFacebook(
    request,
    "owner",
    createPublishWorkflow(request.signal),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prior.mockResolvedValue(null);
  mocks.claim.mockResolvedValue({ kind: "created", jobId: "job-1" });
  mocks.token.mockResolvedValue("page-token");
  mocks.row.mockResolvedValue({ externalAccountId: "123", status: "active" });
  mocks.post.mockResolvedValue("456");
  mocks.status.mockResolvedValue({
    status: {
      video_status: "ready",
      processing_phase: { status: "complete" },
      publishing_phase: { status: "in_progress" },
    },
  });
});
describe("Facebook publishing confirmation", () => {
  it("refuses a destination changed since the user reviewed it", async () => {
    expect((await run("999")).status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("requires an explicit Page selection", async () => {
    expect((await run("")).status).toBe(400);
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("does not equate completed processing with publication", async () => {
    expect((await run()).status).toBe(503);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("checks the stored Reel without creating another", async () => {
    mocks.prior.mockResolvedValue({
      kind: "existing",
      jobId: "job-1",
      status: "uploading",
      externalPostId: "456",
      providerState: { mode: "direct", accountId: "123" },
    });
    mocks.status.mockResolvedValue({
      status: { publishing_phase: { status: "complete" } },
    });
    expect(await (await run()).json()).toMatchObject({
      url: "https://www.facebook.com/reel/456",
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.token).toHaveBeenCalledWith("owner", "facebook", "123");
  });
  it("reports an asynchronous processing rejection", async () => {
    mocks.status.mockResolvedValue({
      status: {
        processing_phase: {
          status: "error",
          error: { message: "Invalid video format" },
        },
      },
    });
    expect(await (await run()).json()).toMatchObject({
      error: "publish_failed",
      message: "Invalid video format",
    });
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
