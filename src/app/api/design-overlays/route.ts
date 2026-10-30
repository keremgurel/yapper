import { withProductAnalytics } from "@/lib/analytics/server";
import { handleSceneRequest } from "@/lib/studio/scene/route-handler";
export const runtime = "nodejs";
export const maxDuration = 300;
async function trackedPOST(req: Request) {
  return handleSceneRequest(req, "design");
}

export const POST = withProductAnalytics("overlay_designed", trackedPOST);
