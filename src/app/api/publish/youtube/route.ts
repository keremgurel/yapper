import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishYouTube } from "@/lib/publish/server/youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishYouTube(req, userId, workflow);
}
