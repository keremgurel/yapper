import { getOwnedMediaKey } from "@/lib/db/submissions";
import { ownsKey } from "@/lib/r2";

/**
 * Resolve the R2 media key a publish request refers to, scoped to the caller.
 * A request may name a `submissionId` (resolved to its key, ownership enforced
 * in the query) or pass a raw `mediaKey`; either way the key must live under
 * the caller's own prefix. Shared by every platform's post route.
 */
export type MediaResolution =
  | { ok: true; mediaKey: string }
  | { ok: false; error: string; status: number };

export async function resolveOwnedMediaKey(
  userId: string,
  body: { submissionId?: string; mediaKey?: string },
): Promise<MediaResolution> {
  const mediaKey = body.submissionId
    ? await getOwnedMediaKey(userId, body.submissionId)
    : body.mediaKey;
  if (!mediaKey) return { ok: false, error: "media_not_found", status: 404 };
  if (!ownsKey(userId, mediaKey)) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  return { ok: true, mediaKey };
}
