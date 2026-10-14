import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishYouTube } from "@/lib/publish/server/youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

async function trackedPOST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishYouTube(req, userId, workflow);
}

export const POST = withProductAnalytics(
  "youtube_publish_requested",
  trackedPOST,
);
