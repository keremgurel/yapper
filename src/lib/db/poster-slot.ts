import { sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";

/** A video stored for posting that has not been posted or scheduled yet. */
export interface WaitingPosterVideo {
  kind: "upload" | "import";
  /** The submission to discard for an upload; the import row for an import. */
  id: string;
  title: string | null;
}

/**
 * Most scheduled videos one account may hold in storage at once. Scheduling
 * keeps a video until it goes out, so without a cap it would be a way around
 * the one-waiting-video rule.
 */
export const MAX_SCHEDULED_VIDEOS = 10;

/**
 * The one video an account may keep in storage while it prepares to post.
 *
 * Posting needs the file with us for a moment (Instagram and Facebook fetch
 * it from a link; YouTube is uploaded from our side), so it cannot be avoided
 * entirely; it can be kept to one. A video stops holding the slot once any
 * post of it succeeds (the nightly job then deletes it) or once it is
 * scheduled (it goes when the schedule does).
 */
export function waitingPosterMediaQuery(userId?: string) {
  return sql`
    select * from (
      select 'upload' as kind, s.id::text as id, s.user_id, s.media_key,
        coalesce((select ci.title from content_items ci where ci.submission_id = s.id limit 1), s.title) as title,
        s.created_at
      from submissions s
      where ${userId ? sql`s.user_id = ${userId}` : sql`true`}
        and s.media_key is not null and s.surface = 'studio'
        and s.media_key not like 'u/%/project-%' and s.media_key not like 'u/%/poster-%'
        and not exists (select 1 from content_items ci where ci.user_id = s.user_id and ci.submission_id = s.id and (ci.editor_revision is not null or ci.source_url = 'yapper://poster-upload'))
        and not exists (select 1 from publish_jobs pj where pj.user_id = s.user_id and pj.media_key = s.media_key and pj.status = 'published')
        and not exists (select 1 from publishing_schedules ps where ps.user_id = s.user_id and ps.status in ('scheduled', 'running', 'needs_attention') and ps.input->>'mediaKey' = s.media_key)
      union all
      select 'import' as kind, i.id::text as id, i.user_id, i.media_key, i.title, i.created_at
      from imported_platform_media i
      where ${userId ? sql`i.user_id = ${userId}` : sql`true`}
        and i.media_key not like 'u/%/ig-import-%'
        and not exists (select 1 from publish_jobs pj where pj.user_id = i.user_id and pj.media_key = i.media_key and pj.status = 'published')
        and not exists (select 1 from publishing_schedules ps where ps.user_id = i.user_id and ps.status in ('scheduled', 'running', 'needs_attention') and ps.input->>'mediaKey' = i.media_key)
    ) waiting
  `;
}

export async function findWaitingPosterVideo(
  userId: string,
  db: Pick<DbTx, "execute"> = getDb(),
  exceptMediaKey?: string,
): Promise<WaitingPosterVideo | null> {
  const rows = await db.execute<{
    kind: "upload" | "import";
    id: string;
    title: string | null;
  }>(sql`
    select kind, id, title from (${waitingPosterMediaQuery(userId)}) waiting
    where ${exceptMediaKey ? sql`media_key <> ${exceptMediaKey}` : sql`true`}
    order by created_at desc, media_key desc, id desc
    limit 1
  `);
  return rows.rows[0] ?? null;
}

export class PosterSlotBusyError extends Error {
  constructor(readonly waiting: WaitingPosterVideo) {
    super("poster_slot_busy");
    this.name = "PosterSlotBusyError";
  }
}

/** Caller holds the storage-user lock; excludes references to this same file. */
export async function assertPosterSlotAvailableWithinTx(
  tx: DbTx,
  userId: string,
  mediaKey: string,
): Promise<void> {
  const waiting = await findWaitingPosterVideo(userId, tx, mediaKey);
  if (waiting) throw new PosterSlotBusyError(waiting);
}

/** How many distinct videos this account has scheduled and not yet sent. */
export async function countScheduledVideos(userId: string): Promise<number> {
  const rows = await getDb().execute<{ n: number }>(sql`
    select count(distinct input->>'mediaKey')::int as n
    from publishing_schedules
    where user_id = ${userId} and status in ('scheduled', 'running', 'needs_attention')
  `);
  return rows.rows[0]?.n ?? 0;
}

/** The refusal every upload route gives while a video is already waiting. */
export function posterSlotBusyResponse(waiting: WaitingPosterVideo): Response {
  return Response.json({ error: "poster_slot_busy", waiting }, { status: 409 });
}
