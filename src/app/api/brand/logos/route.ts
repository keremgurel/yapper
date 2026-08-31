import { auth } from "@clerk/nextjs/server";
import { attachBrandAsset, BrandLogoLimitError } from "@/lib/db/brand";
import { getStorageQuota } from "@/lib/db/billing";
import { ensureUser } from "@/lib/db/users";
import { StorageQuotaError } from "@/lib/db/storage-accounting";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { headObjectBytes, ownsKey, presignView } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await readBoundedJson(req, { maxBytes: 16 * 1024 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mediaKey = typeof body.mediaKey === "string" ? body.mediaKey : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
  if (
    !mediaKey ||
    !ownsKey(userId, mediaKey) ||
    !name ||
    !LOGO_TYPES.has(mimeType)
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const mediaBytes = await headObjectBytes(mediaKey);
  if (mediaBytes === null) {
    return Response.json({ error: "media_not_found" }, { status: 404 });
  }
  if (mediaBytes <= 0 || mediaBytes > MAX_LOGO_BYTES) {
    return Response.json({ error: "media_too_large" }, { status: 413 });
  }

  await ensureUser(userId);
  try {
    const asset = await attachBrandAsset({
      userId,
      mediaKey,
      name,
      mimeType,
      mediaBytes,
      quotaBytes: await getStorageQuota(userId),
    });
    return Response.json({
      logo: {
        id: asset.id,
        name: asset.name,
        mimeType: asset.mimeType,
        mediaBytes: asset.mediaBytes,
        isPrimary: asset.isPrimary,
        url: await presignView(asset.mediaKey),
      },
    });
  } catch (error) {
    if (error instanceof BrandLogoLimitError) {
      return Response.json({ error: "logo_limit" }, { status: 409 });
    }
    if (error instanceof StorageQuotaError) {
      return Response.json({ error: "storage_full" }, { status: 402 });
    }
    throw error;
  }
}
