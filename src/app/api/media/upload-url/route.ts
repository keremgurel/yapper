import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { canUsePremium } from "@/lib/billing/gate";
import { getStorageQuota } from "@/lib/db/billing";
import { MAX_DIRECT_VIDEO_UPLOAD_BYTES } from "@/lib/db/constants";
import { getStorageBytes } from "@/lib/db/users";
import {
  abandonPendingObject,
  allocatePendingObject,
  R2ObjectOwnerMissingError,
  R2PendingAllocationLimitError,
  R2PendingStorageQuotaError,
} from "@/lib/db/r2-lifecycle";
import { mediaKey, presignUpload, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";

const UPLOAD_GRACE_MS = 15 * 60 * 1_000;
const THUMBNAIL_RETENTION_MS = 24 * 60 * 60 * 1_000;
const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024;

/**
 * Presigned R2 PUT so the client uploads a recording directly to R2 (browser
 * CORS friendly). Enforces the storage quota using the claimed size. Returns
 * the object key to attach to the submission.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const { sizeBytes, mimeType, ext, purpose } = (await req
    .json()
    .catch(() => ({}))) as {
    sizeBytes?: number;
    mimeType?: string;
    ext?: string;
    purpose?: unknown;
  };
  if (
    !Number.isSafeInteger(sizeBytes) ||
    !sizeBytes ||
    sizeBytes <= 0 ||
    !mimeType ||
    (purpose !== "recording" && purpose !== "thumbnail") ||
    (purpose === "thumbnail" && !mimeType.startsWith("image/"))
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const purposeLimit =
    purpose === "thumbnail"
      ? MAX_THUMBNAIL_BYTES
      : MAX_DIRECT_VIDEO_UPLOAD_BYTES;
  if (sizeBytes > purposeLimit) {
    return Response.json({ error: "media_too_large" }, { status: 413 });
  }

  const [used, quota] = await Promise.all([
    getStorageBytes(userId),
    getStorageQuota(userId),
  ]);
  if (used + sizeBytes > quota) {
    return Response.json(
      { error: "storage_full", used, quota },
      { status: 402 },
    );
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const key = mediaKey(userId, id, (ext ?? "webm").replace(/[^a-z0-9]/gi, ""));
  // A big file on a slow uplink must not outlive its presigned PUT. Budget for a
  // very slow ~40 KB/s and clamp to 30 min .. 6 hours, so e.g. a 267 MB upload
  // (~114 min at that floor) still has a valid URL the whole way.
  const expiresIn = Math.min(
    21_600,
    Math.max(1_800, Math.ceil(sizeBytes / 40_960)),
  );
  const now = Date.now();
  const uploadExpiresAt = new Date(now + expiresIn * 1_000);
  const deleteNotBefore = new Date(
    purpose === "thumbnail"
      ? now + THUMBNAIL_RETENTION_MS
      : uploadExpiresAt.getTime() +
          Math.max(UPLOAD_GRACE_MS, expiresIn * 1_000),
  );
  try {
    const allocated = await allocatePendingObject(
      userId,
      key,
      purpose,
      sizeBytes,
      quota,
      deleteNotBefore,
      uploadExpiresAt,
    );
    if (!allocated) {
      return Response.json({ error: "upload_key_collision" }, { status: 409 });
    }
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
    throw error;
  }
  try {
    const url = await presignUpload(key, mimeType, sizeBytes, expiresIn);
    return Response.json({ url, key });
  } catch (error) {
    await abandonPendingObject(userId, key, purpose).catch((cleanupError) => {
      console.error("[media] failed to abandon unsigned upload", cleanupError);
    });
    console.error("[media] failed to sign upload", error);
    return Response.json({ error: "storage_unavailable" }, { status: 502 });
  }
}
