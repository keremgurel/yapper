import { auth } from "@clerk/nextjs/server";
import { publishYouTubeCover } from "@/lib/publish/server/youtube-cover";
import { createPublishWorkflow } from "@/lib/publish/workflow";

export const runtime = "nodejs";
// Waiting for YouTube to process the video is capped at a minute.
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishYouTubeCover(req, userId, workflow);
}
