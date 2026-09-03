import { listBrandAssets } from "@/lib/db/brand";
import { getActiveProject } from "@/lib/db/projects";
import { presignView } from "@/lib/r2";
import { paletteFor, type ScenePalette } from "./scene-colors";

/**
 * The brand kit as the designer and the app see it: a palette the scene's
 * tokens resolve against, and at most one logo delivered as `brand.logo`.
 * A project with no kit gets the neutral house palette and no logo, and
 * nothing here throws for that: the kit is an input to a design, not a
 * requirement of one.
 */
export interface BrandLogo {
  key: "brand.logo";
  url: string;
  mimeType: string;
}

export interface BrandContext {
  palette: ScenePalette;
  /** Whether the creator has set any colour or logo at all. */
  hasKit: boolean;
  logos: BrandLogo[];
  /** The kit's own colours, as stored, for the planner's digest. */
  colors: string[];
}

export interface BrandLogoSource {
  url: string;
  mimeType: string;
  isPrimary: boolean;
}

/** The pure part: which logo and which palette a kit yields. */
export function brandContextFrom(
  colors: readonly string[],
  logos: readonly BrandLogoSource[],
): BrandContext {
  const primary = logos.find((logo) => logo.isPrimary) ?? logos[0];
  return {
    palette: paletteFor(colors),
    hasKit: colors.length > 0 || logos.length > 0,
    logos: primary
      ? [{ key: "brand.logo", url: primary.url, mimeType: primary.mimeType }]
      : [],
    colors: [...colors],
  };
}

export const NEUTRAL_BRAND: BrandContext = brandContextFrom([], []);

export async function loadBrandContext(userId: string): Promise<BrandContext> {
  try {
    const [project, assets] = await Promise.all([
      getActiveProject(userId),
      listBrandAssets(userId),
    ]);
    const primary = assets.find((asset) => asset.isPrimary) ?? assets[0];
    const logos: BrandLogoSource[] = primary
      ? [
          {
            url: await presignView(primary.mediaKey),
            mimeType: primary.mimeType,
            isPrimary: true,
          },
        ]
      : [];
    return brandContextFrom(project.brandColors ?? [], logos);
  } catch (error) {
    // A kit that cannot be read should cost the creator a house palette, not
    // the overlays they asked for.
    console.warn(
      "[scene] brand kit unavailable, using the house palette",
      error,
    );
    return NEUTRAL_BRAND;
  }
}
