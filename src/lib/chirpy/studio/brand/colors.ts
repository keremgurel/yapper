import type { BrandColorsInput } from "../../../../../protocol/app-actions.generated";
import { MAX_BRAND_COLORS, normalizeBrandColor } from "@/lib/brand/colors";
import { saveBrandColors } from "@/lib/brand/operations/save-colors";
import { getActiveProject } from "@/lib/db/projects";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";

/** The palette after one change, applied to what is saved now, so a color
 * added since the planner looked is kept. */
export function nextPalette(
  operation: BrandColorsInput["operation"],
  colors: readonly string[],
  current: readonly string[],
): string[] {
  if (operation === "set") return [...colors];
  if (operation === "add") return [...new Set([...current, ...colors])];
  if (operation === "remove")
    return current.filter((color) => !colors.includes(color));
  return [colors[0], ...current.filter((color) => color !== colors[0])];
}

function listed(colors: readonly string[]): string {
  return colors
    .map((color, index) => (index === 0 ? `${color} (primary)` : color))
    .join(", ");
}

/** Through the same save as the Brand tab's palette. */
export const colorsAction: StudioActionDefinition<BrandColorsInput> = {
  async run({ operation, colors }, { userId }) {
    const wanted: string[] = [];
    for (const raw of colors) {
      const color = normalizeBrandColor(raw);
      if (!color)
        throw new StudioActionFailure(
          "bad_color",
          `“${raw.trim()}” isn’t a color I can save exactly. Give me its hex code, like #FF7A21.`,
        );
      if (!wanted.includes(color)) wanted.push(color);
    }
    if (operation === "primary" && wanted.length !== 1)
      throw new StudioActionFailure(
        "bad_request",
        "Name the one color to make primary.",
      );
    const current = (await getActiveProject(userId)).brandColors;
    const next = nextPalette(operation, wanted, current);
    if (next.length > MAX_BRAND_COLORS)
      throw new StudioActionFailure(
        "color_limit",
        `Your kit holds up to ${MAX_BRAND_COLORS} colors. Remove one first.`,
      );
    if (next.join() === current.join())
      return {
        summary:
          operation === "remove"
            ? `${wanted.length === 1 ? `${wanted[0]} wasn’t` : "Those colors weren’t"} in your kit, so nothing changed.`
            : "Your brand colors were already set that way.",
        effects: [],
      };
    const saved = await saveBrandColors(userId, next);
    if (!saved.ok) throw failureFrom(saved, "your brand colors");
    return {
      summary: saved.value.length
        ? `Brand colors are now ${listed(saved.value)}.`
        : "Cleared your brand colors.",
      effects: ["brand"],
    };
  },
};
