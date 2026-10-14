import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import { createPublishWorkflow } from "@/lib/publish/workflow";
import { publishTikTokDirect } from "@/lib/publish/server/tiktok-direct";
export const runtime = "nodejs";
export const maxDuration = 300;
async function trackedPOST(req: Request) {
  const workflow = createPublishWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return publishTikTokDirect(req, userId, workflow);
}

export const POST = withProductAnalytics(
  "tiktok_publish_requested",
  trackedPOST,
);
