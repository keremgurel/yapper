import { auth } from "@clerk/nextjs/server";
import { canUsePremium } from "@/lib/billing/gate";
import { saveEditorMaster } from "@/lib/db/editor-projects";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canUsePremium(userId)))
    return Response.json({ error: "not_entitled" }, { status: 402 });
  const body = await req.json().catch(() => ({}));
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.projectId !== "string" ||
    !uuid.test(body.projectId) ||
    typeof body.submissionId !== "string" ||
    !uuid.test(body.submissionId) ||
    typeof body.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.revision) ||
    typeof body.editedAt !== "number" ||
    !Number.isFinite(body.editedAt) ||
    body.editedAt <= 0 ||
    body.editedAt > Date.now() + 300_000 ||
    typeof body.title !== "string" ||
    typeof body.transcript !== "string"
  ) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    const item = await saveEditorMaster(userId, {
      projectId: body.projectId.toLowerCase(),
      submissionId: body.submissionId,
      revision: body.revision,
      editedAt: new Date(body.editedAt),
      title: body.title.slice(0, 300),
      transcript: body.transcript.slice(0, 100_000),
    });
    return Response.json({ item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "failed";
    if (
      ["bad_submission", "media_unavailable", "newer_edit_available"].includes(
        code,
      )
    )
      return Response.json({ error: code }, { status: 409 });
    throw error;
  }
}
