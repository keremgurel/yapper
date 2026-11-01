import { auth } from "@clerk/nextjs/server";
import { removeVoiceSample } from "@/lib/brain/operations/voice";
import { refusalResponse } from "@/lib/http/operation-result";

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
  const result = await removeVoiceSample(userId, id);
  if (!result.ok) return refusalResponse(result);
  return Response.json({ ok: true });
}
