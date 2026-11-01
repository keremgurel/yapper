import { listContentItems } from "@/lib/db/content";
import { listConnections } from "@/lib/db/publish";
import { listPublishingSchedules } from "@/lib/db/publishing-schedules";
import type { PublishPlatform } from "@/lib/db/schema";
import { isPlatformEnabled } from "@/lib/publish/availability";
import { words } from "../ideas/reads";
import { localDay, localTime } from "../zoned-time";

/** A video Poster can post, as the planner sees it. `source` says which
 * Poster tab it sits under: an upload, an edited project, or a recorded idea. */
export interface VideoGlance {
  id: string;
  title: string;
  source: "upload" | "project" | "recording";
  posted?: true;
}

/** A post the creator already scheduled, in their local time. */
export interface ScheduleGlance {
  id: string;
  videoID?: string;
  title: string;
  platform: PublishPlatform;
  date: string;
  time: string;
  /** Left out while it is simply waiting to go out. */
  status?: string;
}

export interface PosterOverview {
  /** Platforms with an active connection that Yapper can post to now. */
  connected: PublishPlatform[];
  totalVideos: number;
  videos: VideoGlance[];
  schedules: ScheduleGlance[];
}

/** Kept small: this rides in the per-turn part of the prompt. */
export const RECENT_VIDEOS = 8;
export const MATCHED_VIDEOS = 4;
export const LISTED_SCHEDULES = 10;

const POSTER_WORDS =
  /\b(?:post(?:s|ed|ing|er)?|publish\w*|schedul\w*|tiktok|youtube|shorts?|instagram|reels?|facebook|captions?|thumbnails?|uploads?|uploaded|videos?|clips?)\b/i;

/** Poster and schedule data go into a turn only on those tabs, or when the
 * request is about posting. Everywhere else they would be paid for and
 * unused. */
export function wantsPoster(surface: string, request: string): boolean {
  return (
    /^\/studio\/(?:poster|calendar)(?:\/|$)/.test(surface) ||
    POSTER_WORDS.test(request)
  );
}

type ContentRow = Awaited<ReturnType<typeof listContentItems>>[number];

function sourceOf(row: ContentRow): VideoGlance["source"] {
  if (row.sourceUrl?.startsWith("yapper://poster-upload")) return "upload";
  if (row.sourceUrl?.startsWith("yapper://project/")) return "project";
  return "recording";
}

/** The videos Poster lists: library items with a recorded or uploaded file,
 * newest first, plus older ones whose title shares words with the request. */
export function selectVideos(
  rows: readonly ContentRow[],
  request: string,
): ContentRow[] {
  const postable = rows.filter(
    (row) =>
      row.submissionId && row.sourceUrl !== "yapper://poster-upload/completed",
  );
  const chosen = postable.slice(0, RECENT_VIDEOS);
  const wanted = new Set(words(request));
  if (wanted.size) {
    const matched = postable
      .slice(RECENT_VIDEOS)
      .map((row) => ({
        row,
        score: words(row.title).filter((word) => wanted.has(word)).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MATCHED_VIDEOS);
    chosen.push(...matched.map((entry) => entry.row));
  }
  return chosen;
}

export function videoTitle(title: string): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return "Untitled";
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

/** The creator's postable videos, connections and waiting schedules, read for
 * one turn. */
export async function readPosterOverview(
  userId: string,
  request: string,
  timeZone: string,
  now = new Date(),
): Promise<PosterOverview> {
  const [rows, connections, schedules] = await Promise.all([
    listContentItems(userId, { includePosterUploads: true }),
    listConnections(userId),
    listPublishingSchedules(userId),
  ]);
  const videos = selectVideos(rows, request);
  return {
    connected: connections
      .filter(
        (connection) =>
          connection.status === "active" &&
          isPlatformEnabled(connection.platform),
      )
      .map((connection) => connection.platform),
    totalVideos: rows.filter((row) => row.submissionId).length,
    videos: videos.map((row) => ({
      id: row.id,
      title: videoTitle(row.title),
      source: sourceOf(row),
      ...(row.status === "posted" ? { posted: true as const } : {}),
    })),
    schedules: schedules
      .filter(
        (row) =>
          (row.status === "scheduled" && row.scheduledFor > now) ||
          row.status === "needs_attention" ||
          row.status === "failed",
      )
      .slice(0, LISTED_SCHEDULES)
      .map((row) => ({
        id: row.id,
        ...(row.contentItemId ? { videoID: row.contentItemId } : {}),
        title: videoTitle(row.title),
        platform: row.platform,
        date: localDay(row.scheduledFor, timeZone),
        time: localTime(row.scheduledFor, timeZone),
        ...(row.status === "scheduled" ? {} : { status: row.status }),
      })),
  };
}
