import { withProductAnalytics } from "@/lib/analytics/server";
import { handleRenderedReview } from "@/lib/studio/scene/review-rendered";
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = withProductAnalytics(
  "overlay_reviewed",
  handleRenderedReview,
);
