import { auth } from "@clerk/nextjs/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { bumpProjectContext, getActiveProject } from "@/lib/db/projects";
import { deleteVoiceSample } from "@/lib/db/voice-samples";

export const runtime = "nodejs";

/** Takes a video out of the voice set. The channel keeps it; no refund. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const removed = await deleteVoiceSample(userId, id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  const project = await getActiveProject(userId);
  await bumpProjectContext(project.id);
  invalidateBrainContext(project.id);
  return Response.json({ ok: true });
}
