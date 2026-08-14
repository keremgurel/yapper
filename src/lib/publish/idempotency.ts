import type { PublishJobClaim } from "@/lib/db/publish";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function publishIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("Idempotency-Key")?.trim();
  return value && IDEMPOTENCY_KEY.test(value) ? value : null;
}

export function existingPublishResponse(
  platform: "youtube" | "instagram" | "tiktok",
  claim: Extract<PublishJobClaim, { kind: "existing" }>,
): Response {
  if (claim.status === "published") {
    if (platform === "youtube") {
      return Response.json({
        jobId: claim.jobId,
        videoId: claim.externalPostId,
        url: claim.externalUrl ?? undefined,
        replayed: true,
      });
    }
    if (platform === "instagram") {
      return Response.json({
        jobId: claim.jobId,
        mediaId: claim.externalPostId,
        url: claim.externalUrl ?? undefined,
        replayed: true,
      });
    }
    return Response.json({
      jobId: claim.jobId,
      publishId: claim.externalPostId,
      draft: true,
      replayed: true,
    });
  }

  return Response.json(
    {
      error:
        claim.status === "failed"
          ? "publish_attempt_failed"
          : "publish_in_progress",
      jobId: claim.jobId,
    },
    { status: 409 },
  );
}
