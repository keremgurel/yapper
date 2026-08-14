import { describe, expect, it } from "vitest";

import { existingPublishResponse, publishIdempotencyKey } from "./idempotency";

describe("publish idempotency protocol", () => {
  it("accepts bounded opaque keys and rejects absent or malformed keys", () => {
    expect(
      publishIdempotencyKey(
        new Request("https://ypr.app/api/publish/youtube", {
          headers: { "Idempotency-Key": "attempt_1234" },
        }),
      ),
    ).toBe("attempt_1234");
    expect(
      publishIdempotencyKey(new Request("https://ypr.app/api/publish/youtube")),
    ).toBeNull();
    expect(
      publishIdempotencyKey(
        new Request("https://ypr.app/api/publish/youtube", {
          headers: { "Idempotency-Key": "bad key" },
        }),
      ),
    ).toBeNull();
    expect(
      publishIdempotencyKey(
        new Request("https://ypr.app/api/publish/youtube", {
          headers: { "Idempotency-Key": `a${"b".repeat(128)}` },
        }),
      ),
    ).toBeNull();
  });

  it("replays a durable provider result without starting another operation", async () => {
    const response = existingPublishResponse("youtube", {
      kind: "existing",
      jobId: "job_1",
      status: "published",
      externalPostId: "video_1",
      externalUrl: "https://youtube.com/watch?v=video_1",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobId: "job_1",
      videoId: "video_1",
      url: "https://youtube.com/watch?v=video_1",
      replayed: true,
    });
  });

  it.each([
    ["uploading", "publish_in_progress"],
    ["processing", "publish_in_progress"],
    ["failed", "publish_attempt_failed"],
  ] as const)("returns the durable %s state", async (status, error) => {
    const response = existingPublishResponse("instagram", {
      kind: "existing",
      jobId: "job_1",
      status,
      externalPostId: null,
      externalUrl: null,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error, jobId: "job_1" });
  });
});
