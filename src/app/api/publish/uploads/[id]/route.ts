import { auth } from "@clerk/nextjs/server";
import { removePosterUpload } from "@/lib/publish/operations/remove-upload";

export const runtime = "nodejs";

/** Remove a waiting Poster upload, never a project or a platform post. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await removePosterUpload(userId, id);
  if (result.ok) return Response.json({ ok: true });
  if (result.error === "video_in_use")
    return Response.json(
      { error: result.error, message: result.detail },
      { status: result.status },
    );
  return Response.json({ error: result.error }, { status: result.status });
}
