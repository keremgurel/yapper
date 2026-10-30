import { withProductAnalytics } from "@/lib/analytics/server";
import { handleSceneRequest } from "@/lib/studio/scene/route-handler";
export const runtime = "nodejs";
export const maxDuration = 120;
async function trackedPOST(req: Request) {
  return handleSceneRequest(req, "direct");
}

export const POST = withProductAnalytics("overlays_directed", trackedPOST);
