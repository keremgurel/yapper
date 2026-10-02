import { auth } from "@clerk/nextjs/server";
import { findPreviousAttempt } from "@/lib/db/previous-attempt";

export const runtime = "nodejs";

/** The signed-in user's earlier attempt at the same prompt, for comparison. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const previous = await findPreviousAttempt(userId, id);
  return Response.json({
    previous: previous && {
      id: previous.id,
      createdAt: previous.createdAt,
      scores: previous.feedback.coaching?.scores ?? null,
      metrics: previous.feedback.metrics ?? null,
    },
  });
}
