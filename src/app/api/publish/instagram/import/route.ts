import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { canUsePremium } from "@/lib/billing/gate";
import { getStorageQuota } from "@/lib/db/billing";
import { MAX_CLIP_BYTES } from "@/lib/db/constants";
import {
  ImportedMediaQuotaError,
  importedMediaForPost,
  reconcileImportedMediaBytes,
  registerImportedMedia,
  invalidateMissingImportedMedia,
  type ImportedMediaRecord,
} from "@/lib/db/imported-media";
import { ensureUser, getStorageBytes } from "@/lib/db/users";
import {
  allocatePendingObject,
  enqueueObjectDeletion,
  R2ObjectOwnerMissingError,
  R2PendingAllocationLimitError,
  R2PendingStorageQuotaError,
} from "@/lib/db/r2-lifecycle";
import {
  getFreshAccessToken,
  NoConnectionError,
} from "@/lib/publish/connection";
import {
  downloadInstagramClip,
  fetchInstagramMediaForImport,
  InstagramClipTooLargeError,
  InstagramDownloadTimeoutError,
} from "@/lib/publish/instagram-import";
import { resolveInstagramSourceFile } from "@/lib/publish/instagram-source-file";
import {
  headObjectBytes,
  mediaKey,
  putObjectFile,
  r2Configured,
} from "@/lib/r2";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const PLATFORM = "instagram" as const;
const LOOKUP_TIMEOUT_MS = 45_000;
const OVERALL_TIMEOUT_MS = 105_000;
const FAILED_IMPORT_RETENTION_MS = 15 * 60 * 1_000;

function importAttemptKey(userId: string): string {
  // Never reuse the post id as an object key. Every request owns exactly one
  // random object, so a losing request can clean up without deleting a winner.
  return mediaKey(userId, `ig-import-${randomUUID()}`, "mp4");
}

async function enqueueAttemptDeletion(
  userId: string,
  key: string,
  reason: string,
): Promise<void> {
  try {
    await enqueueObjectDeletion(userId, key, reason, undefined, "import");
  } catch (error) {
    // The pending allocation remains durable and will become eligible for the
    // lifecycle sweeper even if this eager transition could not be recorded.
    console.error("[publish] instagram import cleanup enqueue failed", error);
  }
}

function importedResponse(row: ImportedMediaRecord): Response {
  return Response.json({ mediaKey: row.mediaKey, title: row.title ?? "" });
}

/**
 * Pull one of the user's own Instagram videos into their R2 storage so the
 * normal publish path can cross-post it elsewhere. Entitlement is checked
 * before cache/provider work, remote bytes are streamed under a hard limit,
 * and the object becomes visible only after atomic quota registration.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as { mediaId?: unknown };
  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId || mediaId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(mediaId)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const quotaBytes = await getStorageQuota(userId);
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "instagram-import",
  );
  if (spendLimited) return spendLimited;
  const deadline = AbortSignal.any([
    req.signal,
    AbortSignal.timeout(OVERALL_TIMEOUT_MS),
  ]);

  // A cache row is usable only while its object still exists. Legacy rows have
  // zero bytes after migration; reconcile them against HeadObject before they
  // can bypass accounting.
  const cached = await importedMediaForPost(userId, PLATFORM, mediaId);
  if (cached) {
    const actualBytes = await headObjectBytes(cached.mediaKey);
    if (actualBytes === null) {
      await invalidateMissingImportedMedia(
        userId,
        PLATFORM,
        mediaId,
        cached.mediaKey,
      );
    } else {
      if (actualBytes <= 0) {
        return Response.json({ error: "download_failed" }, { status: 502 });
      }
      if (actualBytes > MAX_CLIP_BYTES) {
        return Response.json({ error: "clip_too_large" }, { status: 413 });
      }
      try {
        const reconciled = await reconcileImportedMediaBytes(
          userId,
          PLATFORM,
          mediaId,
          cached.mediaKey,
          actualBytes,
          quotaBytes,
        );
        if (reconciled) return importedResponse(reconciled);
      } catch (error) {
        if (error instanceof ImportedMediaQuotaError) {
          return Response.json({ error: "storage_full" }, { status: 402 });
        }
        throw error;
      }
      // The row changed between lookup and reconciliation; continue as a fresh
      // attempt rather than returning a key we no longer own in the database.
    }
  }

  // A cached object remains usable at the cap because it consumes no new
  // bytes. A genuinely fresh import cannot fit when the account is already
  // full, so avoid paid provider work and a doomed transfer in that case.
  if ((await getStorageBytes(userId)) >= quotaBytes) {
    return Response.json({ error: "storage_full" }, { status: 402 });
  }

  let accessToken: string;
  try {
    accessToken = await getFreshAccessToken(userId, PLATFORM);
  } catch (error) {
    if (error instanceof NoConnectionError) {
      return Response.json({ error: "not_connected" }, { status: 409 });
    }
    throw error;
  }

  let media: Awaited<ReturnType<typeof fetchInstagramMediaForImport>>;
  let sourceFileUrl: string;
  try {
    const lookupSignal = AbortSignal.any([
      deadline,
      AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    ]);
    media = await fetchInstagramMediaForImport(
      accessToken,
      mediaId,
      lookupSignal,
    );
    sourceFileUrl = await resolveInstagramSourceFile(media, lookupSignal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_a_video") {
      return Response.json({ error: "not_a_video" }, { status: 422 });
    }
    if (message === "no_source_file") {
      return Response.json({ error: "no_source_file" }, { status: 422 });
    }
    if ((error as { name?: string }).name === "TimeoutError") {
      return Response.json({ error: "import_timeout" }, { status: 504 });
    }
    console.error("[publish] instagram import lookup failed", error);
    return Response.json({ error: "import_failed" }, { status: 502 });
  }

  let clip: Awaited<ReturnType<typeof downloadInstagramClip>>;
  try {
    clip = await downloadInstagramClip(sourceFileUrl, { signal: deadline });
  } catch (error) {
    if (error instanceof InstagramClipTooLargeError) {
      return Response.json({ error: "clip_too_large" }, { status: 413 });
    }
    if (error instanceof InstagramDownloadTimeoutError) {
      return Response.json({ error: "download_timeout" }, { status: 504 });
    }
    return Response.json({ error: "download_failed" }, { status: 502 });
  }

  let key = "";
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = importAttemptKey(userId);
      const allocated = await allocatePendingObject(
        userId,
        candidate,
        "import",
        clip.byteLength,
        quotaBytes,
        new Date(Date.now() + FAILED_IMPORT_RETENTION_MS),
      );
      if (allocated) {
        key = candidate;
        break;
      }
    }
    if (!key) {
      return Response.json({ error: "upload_key_collision" }, { status: 409 });
    }
    await putObjectFile(
      key,
      clip.filePath,
      clip.byteLength,
      clip.contentType,
      deadline,
    );
  } catch (error) {
    if (error instanceof R2PendingAllocationLimitError) {
      return Response.json(
        { error: "too_many_pending_uploads" },
        { status: 429 },
      );
    }
    if (error instanceof R2PendingStorageQuotaError) {
      return Response.json({ error: "storage_full" }, { status: 402 });
    }
    if (error instanceof R2ObjectOwnerMissingError) {
      return Response.json({ error: "user_not_ready" }, { status: 409 });
    }
    if (key) {
      await enqueueAttemptDeletion(userId, key, "import_upload_failed");
    }
    console.error("[publish] instagram import upload failed", error);
    return Response.json({ error: "storage_unavailable" }, { status: 502 });
  } finally {
    await clip.cleanup().catch((error) => {
      console.error("[publish] instagram temp cleanup failed", error);
    });
  }

  try {
    const registration = await registerImportedMedia(
      userId,
      PLATFORM,
      mediaId,
      key,
      clip.byteLength,
      media.title,
      quotaBytes,
    );
    if (registration.kind === "existing") {
      await enqueueAttemptDeletion(userId, key, "import_race_loser");
    }
    return importedResponse(registration);
  } catch (error) {
    if (error instanceof ImportedMediaQuotaError) {
      await enqueueAttemptDeletion(userId, key, "import_quota_rejected");
      return Response.json({ error: "storage_full" }, { status: 402 });
    }

    // A connection can fail after PostgreSQL committed. Read the unique row
    // back before cleanup: delete only when a successful reconciliation proves
    // this exact attempt did not become durable. If the read also fails, retain
    // the unique object for a lifecycle/reconciliation sweep rather than break
    // a row that may have committed.
    try {
      const durable = await importedMediaForPost(userId, PLATFORM, mediaId);
      if (durable?.mediaKey === key) return importedResponse(durable);
      await enqueueAttemptDeletion(userId, key, "import_registration_failed");
      if (durable) return importedResponse(durable);
    } catch (reconciliationError) {
      console.error(
        "[publish] instagram import commit reconciliation failed",
        reconciliationError,
      );
    }
    console.error("[publish] instagram import registration failed", error);
    return Response.json({ error: "import_failed" }, { status: 502 });
  }
}
