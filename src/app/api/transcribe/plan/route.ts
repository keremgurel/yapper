import { auth } from "@clerk/nextjs/server";
import { transcriptionPiecePlan } from "@/lib/transcription/piece-plan";

export const runtime = "nodejs";

/**
 * Tells the editor how to cut a take before it uploads anything. The right
 * piece length depends on which transcriber is first in line, and that is
 * decided here, so the editor asks instead of assuming. An editor that gets no
 * answer keeps the overlapping pieces every transcriber can work with.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(transcriptionPiecePlan(), {
    headers: { "Cache-Control": "no-store" },
  });
}
