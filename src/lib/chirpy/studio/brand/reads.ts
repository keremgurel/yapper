import { listBrandAssets } from "@/lib/db/brand";
import { getActiveProject } from "@/lib/db/projects";

/** The brand kit as the planner sees it: at most 8 colors and 8 logos. */
export interface BrandOverview {
  /** Saved order; the first is primary. */
  colors: string[];
  logos: { id: string; name: string; primary: boolean }[];
}

const MENTIONS_BRAND =
  /\b(?:brand|colou?rs?|palette|logos?|hex)\b|#[\da-f]{3}(?:[\da-f]{3})?\b/i;

/** The kit costs prompt tokens, so it is read on the Brand tab and for
 * requests that talk about it, and nowhere else. */
export function wantsBrand(surface: string, request: string): boolean {
  return surface.startsWith("/studio/brand") || MENTIONS_BRAND.test(request);
}

export async function readBrandOverview(
  userId: string,
): Promise<BrandOverview> {
  const [project, assets] = await Promise.all([
    getActiveProject(userId),
    listBrandAssets(userId),
  ]);
  return {
    colors: project.brandColors,
    logos: assets.map((asset) => ({
      id: asset.id,
      name: asset.name.slice(0, 80),
      primary: asset.isPrimary,
    })),
  };
}
