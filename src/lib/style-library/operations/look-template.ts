import type { StyleLookRow } from "@/lib/db/style-looks";
import type { StyleBlock } from "../format/style-block";
import {
  describeTemplate,
  type TemplateDescription,
} from "../templates/describe-template";
import type { Template, TemplateLayer } from "../templates/template";

export const MAX_LOOKS = 50;
export const MAX_LOOK_NAME = 60;

/** A saved look as the library's template, so everything that reads or edits a template works on it. */
export const lookAsTemplate = (look: StyleLookRow): Template => ({
  id: look.id,
  name: look.name,
  summary: "",
  layers: look.layers,
});

/** What a person, Chirpy or a connector sees of a look: its places, blocks and settings. */
export const describeLook = (look: StyleLookRow): TemplateDescription =>
  describeTemplate(lookAsTemplate(look));

/** A look as the app receives it: described for reading, with its layers for drawing. */
export const lookPayload = (look: StyleLookRow) => ({
  ...describeLook(look),
  layers: look.layers,
});

function bare(block: StyleBlock | null): StyleBlock | null {
  if (!block) return null;
  return {
    styleId: block.styleId,
    ...(block.options ? { options: block.options } : {}),
    slots: Object.fromEntries(
      Object.entries(block.slots ?? {}).map(([name, child]) => [
        name,
        bare(child),
      ]),
    ),
  };
}

/**
 * A template's arrangement and options without what it was showing. A library
 * template carries sample pictures and numbers for its preview, and a look
 * copied from it should start with the creator's own.
 */
export const withoutContent = (
  layers: readonly TemplateLayer[],
): TemplateLayer[] =>
  layers.map((layer) => ({ ...layer, block: bare(layer.block) }));

export const lookName = (raw: string | undefined, fallback: string): string =>
  (raw?.trim() || fallback).slice(0, MAX_LOOK_NAME);
