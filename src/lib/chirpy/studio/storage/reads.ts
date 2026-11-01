import { and, desc, eq, inArray } from "drizzle-orm";
import { getStorageQuota } from "@/lib/db/billing";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { listStoredVideos, type StoredVideo } from "@/lib/db/storage-videos";
import { getStorageBytes } from "@/lib/db/users";
import { formatStorageBytes, storageUsagePercent } from "@/lib/storage/format";

/** Retention states the tab's video manager will not remove. */
const PROTECTED = ["editor_current", "scheduled", "publishing"] as const;

/** One stored video as the planner sees it. */
export interface StoredVideoGlance {
  /** The media key after `u/<userId>/`. */
  id: string;
  title: string;
  size: string;
  kind: StoredVideo["origin"];
  /** Why it cannot be removed now, when it cannot. */
  keep?: (typeof PROTECTED)[number];
  /** The recording that holds it, for deleting the recording itself. */
  recordingID?: string;
}

export interface StorageOverview {
  used: string;
  quota: string;
  percent: number;
  /** Only on the Storage tab. */
  totalVideos?: number;
  largest?: StoredVideoGlance[];
}

/** Names and sizes a confirmation question uses; never sent to the model. */
export interface StorageNames {
  videos: Record<string, string>;
  recordings: Record<string, string>;
  /** Bytes by video id or recording id. */
  sizes: Record<string, string>;
}

export const LARGEST_VIDEOS = 8;

const MENTIONS_STORAGE =
  /\b(?:storage|space|quota|[gmk]b|gigabytes?|megabytes?|files?)\b/i;

/** The list of videos is read only on the Storage tab. Elsewhere a request
 * about storage gets the usage numbers alone. */
export function wantsStorage(
  surface: string,
  request: string,
): "list" | "usage" | null {
  if (surface.startsWith("/studio/storage")) return "list";
  return MENTIONS_STORAGE.test(request) ? "usage" : null;
}

export function videoID(userId: string, mediaKey: string): string {
  const prefix = `u/${userId}/`;
  return mediaKey.startsWith(prefix) ? mediaKey.slice(prefix.length) : mediaKey;
}

export function mediaKeyOf(userId: string, id: string): string {
  return id.startsWith("u/") ? id : `u/${userId}/${id}`;
}

async function latestRecordings(userId: string, keys: string[]) {
  if (!keys.length) return new Map<string, string>();
  const rows = await getDb()
    .select({ id: submissions.id, mediaKey: submissions.mediaKey })
    .from(submissions)
    .where(
      and(eq(submissions.userId, userId), inArray(submissions.mediaKey, keys)),
    )
    .orderBy(desc(submissions.createdAt));
  const latest = new Map<string, string>();
  for (const row of rows)
    if (row.mediaKey && !latest.has(row.mediaKey))
      latest.set(row.mediaKey, row.id);
  return latest;
}

export async function readStorageOverview(
  userId: string,
  scope: "list" | "usage",
): Promise<{ storage: StorageOverview; names: StorageNames }> {
  const [usedBytes, quotaBytes, videos] = await Promise.all([
    getStorageBytes(userId),
    getStorageQuota(userId),
    scope === "list" ? listStoredVideos(userId) : [],
  ]);
  const storage: StorageOverview = {
    used: formatStorageBytes(usedBytes),
    quota: formatStorageBytes(quotaBytes),
    percent: Math.round(storageUsagePercent(usedBytes, quotaBytes)),
  };
  const names: StorageNames = { videos: {}, recordings: {}, sizes: {} };
  if (scope === "usage") return { storage, names };

  const largest = [...videos]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, LARGEST_VIDEOS);
  const recordings = await latestRecordings(
    userId,
    largest.map((video) => video.mediaKey),
  );
  storage.totalVideos = videos.length;
  storage.largest = largest.map((video) => {
    const id = videoID(userId, video.mediaKey);
    const title = video.title.slice(0, 100);
    const recordingID = recordings.get(video.mediaKey);
    const keep = PROTECTED.find((state) => state === video.retention);
    names.videos[id] = title;
    names.sizes[id] = String(video.bytes);
    if (recordingID) {
      names.recordings[recordingID] = title;
      names.sizes[recordingID] = String(video.bytes);
    }
    return {
      id,
      title,
      size: formatStorageBytes(video.bytes),
      kind: video.origin,
      ...(keep ? { keep } : {}),
      ...(recordingID ? { recordingID } : {}),
    };
  });
  return { storage, names };
}
