import { auth } from "@clerk/nextjs/server";
import { attachPronunciation } from "@/lib/db/pronunciation";
import { parsePronunciation } from "@/lib/pronunciation/parse";

export const runtime = "nodejs";

const MAX_BODY_CHARS = 8_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Save the pronunciation scores the browser measured for one of the user's
 * own finished sessions. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json({ error: "not_found" }, { status: 404 });

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS)
    return Response.json({ error: "too_large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const report = parsePronunciation(body);
  if (!report) return Response.json({ error: "bad_request" }, { status: 400 });

  const saved = await attachPronunciation(userId, id, report);
  return Response.json({ saved });
}
