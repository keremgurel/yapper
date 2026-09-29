import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { r2Objects } from "@/lib/db/schema";
import { releasePostedMedia } from "@/lib/db/posted-media-retention";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";
import {
  readBoundedJson,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";

export const runtime = "nodejs";

/** Storage management uses the caller's existing native/web session. No browser
 * handoff, public media URL, or client-supplied account identity is involved. */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const rows = await getDb().execute(sql`
    select r.media_key as "mediaKey", r.media_bytes::double precision as bytes,
      coalesce((select s.title from submissions s where s.user_id = r.user_id and s.media_key = r.media_key order by s.created_at desc limit 1),
        (select i.title from imported_platform_media i where i.user_id = r.user_id and i.media_key = r.media_key limit 1), 'Untitled video') as title
    from r2_objects r where r.user_id = ${userId} and r.state = 'active' and r.purpose in ('recording', 'import')
    order by r.created_at desc limit 100
  `);
  return Response.json({ videos: rows.rows });
}

export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await readBoundedJson(req, { maxBytes: 4096 });
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const mediaKey = (body as { mediaKey?: unknown } | null)?.mediaKey;
  if (typeof mediaKey !== "string" || !mediaKey || mediaKey.length > 1024)
    return Response.json({ error: "bad_request" }, { status: 400 });
  const [owned] = await getDb()
    .select({ key: r2Objects.mediaKey })
    .from(r2Objects)
    .where(
      and(
        eq(r2Objects.userId, userId),
        eq(r2Objects.mediaKey, mediaKey),
        eq(r2Objects.state, "active"),
        inArray(r2Objects.purpose, ["recording", "import"]),
      ),
    )
    .limit(1);
  if (!owned) return Response.json({ error: "not_found" }, { status: 404 });
  const result = await releasePostedMedia(
    { userId, mediaKey },
    "user_requested",
  );
  if (result !== "released")
    return Response.json(
      {
        error: "video_in_use",
        message:
          "This video is still needed for a scheduled post, publishing retry or recent upload. Cancel its schedule or try again after processing finishes.",
      },
      { status: 409 },
    );
  drainR2AfterResponse();
  return Response.json({ ok: true });
}
