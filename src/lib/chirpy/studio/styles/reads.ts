import { listStyleLooks } from "@/lib/db/style-looks";
import type { OptionSpec } from "@/lib/style-library/format/option-spec";
import { lookAsTemplate } from "@/lib/style-library/operations/look-template";
import { STYLES } from "@/lib/style-library/registry";
import { TEMPLATES } from "@/lib/style-library/templates/registry";
import { listPlaces } from "@/lib/style-library/templates/template-places";

/**
 * The style library and the creator's looks as the planner sees them, and as
 * a connector reads them. Written short: option limits are one string each.
 */
export interface StylesOverview {
  /** Library templates a look can start from. */
  templates: { id: string; name: string; summary: string }[];
  /** Every block, with the option keys an edit may set and what each takes. */
  blocks: {
    id: string;
    name: string;
    /** Slot name to the shelves it accepts, for blocks with open areas. */
    slots?: Record<string, string>;
    options: Record<string, string>;
    content: string[];
  }[];
  looks: {
    id: string;
    name: string;
    /** Each place with the block in it and the options changed from its defaults. */
    places: {
      at: string;
      block: string | null;
      options?: Record<string, unknown>;
    }[];
  }[];
}

const MENTIONS_STYLES =
  /\b(?:(?:my|saved|new) looks?|templates?|style library|split[- ]?screens?|half[- ]and[- ]half|backdrops?|caption (?:style|colou?r|size)s?)\b/i;

/** The library costs prompt tokens, so it is read for requests about looks and nowhere else. */
export function wantsStyles(surface: string, request: string): boolean {
  return surface.startsWith("/studio/styles") || MENTIONS_STYLES.test(request);
}

const takes = (spec: OptionSpec): string => {
  switch (spec.kind) {
    case "number":
      return `number ${spec.min} to ${spec.max}`;
    case "enum":
      return spec.choices.map((choice) => choice.value).join(" | ");
    case "color":
      return "hex colour or brand token";
    case "media":
      return `${spec.accepts.join(" or ")} URL`;
    default:
      return spec.kind;
  }
};

const BLOCKS: StylesOverview["blocks"] = STYLES.map((style) => ({
  id: style.id,
  name: style.name,
  ...(style.slots
    ? {
        slots: Object.fromEntries(
          Object.entries(style.slots).map(([name, slot]) => [
            name,
            slot.accepts.join(", "),
          ]),
        ),
      }
    : {}),
  options: Object.fromEntries(
    Object.entries(style.options).map(([key, spec]) => [key, takes(spec)]),
  ),
  // The take and the transcript come from the video, never from an edit.
  content: Object.keys(style.content).filter(
    (key) => key !== "take" && key !== "words",
  ),
}));

export async function readStylesOverview(
  userId: string,
): Promise<StylesOverview> {
  const looks = await listStyleLooks(userId);
  return {
    templates: TEMPLATES.map(({ id, name, summary }) => ({
      id,
      name,
      summary,
    })),
    blocks: BLOCKS,
    looks: looks.map((look) => ({
      id: look.id,
      name: look.name,
      places: listPlaces(lookAsTemplate(look)).map((place) => ({
        at: place.path,
        block: place.block?.styleId ?? null,
        ...(place.block?.options && Object.keys(place.block.options).length
          ? { options: place.block.options }
          : {}),
      })),
    })),
  };
}
