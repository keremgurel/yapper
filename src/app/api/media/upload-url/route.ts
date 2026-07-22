import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getStorageQuota } from "@/lib/db/billing";
import { getStorageBytes } from "@/lib/db/users";
import { mediaKey, presignUpload, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Presigned R2 PUT so the client uploads a recording directly to R2 (browser
 * CORS friendly). Enforces the storage quota using the claimed size. Returns
 * the object key to attach to the submission.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!r2Configured()) {
    return Response.json({ error: "storage_unavailable" }, { status: 501 });
  }

  const { sizeBytes, mimeType, ext } = (await req.json().catch(() => ({}))) as {
    sizeBytes?: number;
    mimeType?: string;
    ext?: string;
  };
  if (!sizeBytes || sizeBytes <= 0 || !mimeType) {
    return Response.json({ error: "bad_request" }, { status: 400 });
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
  const url = await presignUpload(key, mimeType, expiresIn);
  return Response.json({ url, key });
}
