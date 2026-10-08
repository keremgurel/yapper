import { sql } from "drizzle-orm";
import { getDb } from "./client";

export type StoredVideo = {
  mediaKey: string;
  bytes: number;
  title: string;
  origin: "editor_export" | "upload" | "recording" | "import";
  platform: string | null;
  retention:
    | "editor_current"
    | "scheduled"
    | "publishing"
    | "retry"
    | "cleanup"
    | "stored";
};

/** Same physical objects as the storage totals, including files outside Uploads.
 * All lookups stay scoped to the object's owner. No signed download URLs. */
export async function listStoredVideos(userId: string): Promise<StoredVideo[]> {
  const result = await getDb().execute<StoredVideo>(sql`
    select r.media_key as "mediaKey", r.media_bytes::double precision as bytes,
      coalesce(s.title, i.title, 'Untitled video') as title,
      case when r.purpose = 'import' then 'import'
        when ci.editor_revision is not null or r.media_key like 'u/%/project-%' then 'editor_export'
        when ci.source_url like 'yapper://poster-upload%' then 'upload'
        else 'recording' end as origin,
      i.platform,
      case
        when exists (select 1 from publishing_schedules ps where ps.user_id = r.user_id
          and ps.input->>'mediaKey' = r.media_key and ps.status in ('scheduled', 'running', 'needs_attention')) then 'scheduled'
        when exists (select 1 from publish_jobs pj where pj.user_id = r.user_id
          and pj.media_key = r.media_key and pj.status in ('queued', 'uploading', 'processing')) then 'publishing'
        when ci.editor_revision is not null and coalesce(ci.source_client_id, '') not like 'native-project:%:archived:%'
          and not exists (select 1 from publish_jobs pj where pj.user_id = r.user_id
            and pj.media_key = r.media_key and pj.status = 'published') then 'editor_current'
        when exists (select 1 from publish_jobs pj where pj.user_id = r.user_id
          and pj.media_key = r.media_key and pj.updated_at >= now() - interval '24 hours') then 'retry'
        when exists (select 1 from publish_jobs pj where pj.user_id = r.user_id
          and pj.media_key = r.media_key and pj.status = 'published') then 'cleanup'
        else 'stored' end as retention
    from r2_objects r
    left join lateral (select s.* from submissions s where s.user_id = r.user_id
      and s.media_key = r.media_key order by s.created_at desc limit 1) s on true
    left join lateral (select ci.* from content_items ci join submissions linked on linked.id = ci.submission_id
      where ci.user_id = r.user_id and linked.user_id = r.user_id and linked.media_key = r.media_key
      order by (ci.editor_revision is not null and coalesce(ci.source_client_id, '') not like 'native-project:%:archived:%') desc,
        ci.created_at desc limit 1) ci on true
    left join lateral (select i.title, i.platform from imported_platform_media i
      where i.user_id = r.user_id and i.media_key = r.media_key limit 1) i on true
    where r.user_id = ${userId} and r.state = 'active' and r.purpose in ('recording', 'import')
    order by r.created_at desc, r.media_key
  `);
  return result.rows;
}
