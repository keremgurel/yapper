import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishInstagram } from "@/lib/publish/server/instagram";

export const runtime = "nodejs";
export const maxDuration = 300;

async function trackedPOST(req: Request): Promise<Response> {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishInstagram(req, userId, workflow);
}

export const POST = withProductAnalytics(
  "instagram_publish_requested",
  trackedPOST,
);
