import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPublishWorkflow } from "../workflow";
import { publishYouTubeCover } from "./youtube-cover";

const mocks = vi.hoisted(() => ({
  job: vi.fn(),
  token: vi.fn(),
  processed: vi.fn(),
  setThumbnail: vi.fn(),
  file: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("@/lib/db/publish", () => ({ findPublishJobClaim: mocks.job }));
vi.mock("@/lib/publish/connection", () => ({
  getFreshAccessToken: mocks.token,
  NoConnectionError: class extends Error {},
}));
vi.mock("@/lib/publish/youtube", () => ({
  waitForYouTubeProcessing: mocks.processed,
  setYouTubeThumbnail: mocks.setThumbnail,
}));
vi.mock("@/lib/r2", () => ({
  getObjectFile: mocks.file,
  ownsKey: (userId: string, key: string) => key.startsWith(`u/${userId}/`),
}));

function run(
  body: unknown = { thumbnailKey: "u/owner/cover.jpg" },
  key = "youtube_attempt_1",
) {
  const request = new Request("https://ypr.app/api/publish/youtube/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
  return publishYouTubeCover(
    request,
    "owner",
    createPublishWorkflow(request.signal),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.job.mockResolvedValue({
    kind: "existing",
    jobId: "job-1",
    status: "published",
    externalPostId: "video-1",
    externalUrl: "https://youtu.be/video-1",
  });
  mocks.token.mockResolvedValue("token");
  mocks.processed.mockResolvedValue(undefined);
  mocks.setThumbnail.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.file.mockResolvedValue({
    filePath: "/tmp/cover.jpg",
    byteLength: 10,
    cleanup: mocks.cleanup,
  });
});

describe("deferred YouTube cover", () => {
  it("sets the cover on the video this attempt published", async () => {
    expect(await (await run()).json()).toEqual({ coverApplied: true });
    expect(mocks.job).toHaveBeenCalledWith(
      "owner",
      "youtube",
      "youtube_attempt_1",
    );
    expect(mocks.processed).toHaveBeenCalledWith(
      "token",
      "video-1",
      expect.anything(),
    );
    expect(mocks.setThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "video-1", mimeType: "image/jpeg" }),
      expect.anything(),
    );
    expect(mocks.cleanup).toHaveBeenCalled();
  });

  it("reports a cover YouTube would not take without failing the post", async () => {
    mocks.setThumbnail.mockRejectedValue(new Error("youtube_thumbnail_403"));
    const response = await run();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ coverApplied: false });
    expect(mocks.cleanup).toHaveBeenCalled();
  });

  it("reports a cover that timed out waiting on processing", async () => {
    mocks.processed.mockRejectedValue(
      new Error("youtube_thumbnail_processing_timeout"),
    );
    expect(await (await run()).json()).toEqual({ coverApplied: false });
    expect(mocks.setThumbnail).not.toHaveBeenCalled();
  });

  it("refuses an image the user does not own", async () => {
    expect((await run({ thumbnailKey: "u/someone/cover.jpg" })).status).toBe(
      400,
    );
    expect(mocks.job).not.toHaveBeenCalled();
  });

  it("refuses a missing image or attempt key", async () => {
    expect((await run({})).status).toBe(400);
    expect((await run(undefined, "x")).status).toBe(400);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it.each([
    [null],
    [{ status: "uploading", externalPostId: null }],
    [{ status: "failed", externalPostId: null }],
  ])(
    "waits for a finished upload before touching YouTube (%j)",
    async (job) => {
      mocks.job.mockResolvedValue(job);
      expect((await run()).status).toBe(409);
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.setThumbnail).not.toHaveBeenCalled();
    },
  );
});
