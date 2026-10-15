import type { PublishPlatform } from "@/lib/db/schema";
/** Theme-aware platform series. Counts and names always accompany color. */
export const CHART_COLORS: Record<PublishPlatform, string> = {
  youtube: "var(--sg-chart-youtube)",
  instagram: "var(--sg-chart-instagram)",
  tiktok: "var(--sg-chart-tiktok)",
  facebook: "var(--sg-chart-facebook)",
};
