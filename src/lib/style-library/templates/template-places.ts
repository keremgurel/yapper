import type { StyleBlock } from "../format/style-block";
import type { StyleCategoryId } from "../format/style-category";
import { getStyle } from "../registry";
import type { Template } from "./template";

/**
 * Somewhere a block can go: a layer, or a slot inside a block. Addressed by a
 * dotted path such as `layout`, `layout.top` or `captions`.
 */
export interface TemplatePlace {
  path: string;
  label: string;
  accepts: readonly StyleCategoryId[];
  block: StyleBlock | null;
}

function slotPlaces(
  parentPath: string,
  block: StyleBlock | null,
): TemplatePlace[] {
  const slots = (block && getStyle(block.styleId)?.slots) ?? {};
  return Object.entries(slots).flatMap(([name, spec]) => {
    const child = block?.slots?.[name] ?? null;
    const path = `${parentPath}.${name}`;
    return [
      { path, label: spec.label, accepts: spec.accepts, block: child },
      ...slotPlaces(path, child),
    ];
  });
}

/** Every place in the template, layers first-to-last with their slots after each. */
export function listPlaces(template: Template): TemplatePlace[] {
  return template.layers.flatMap((layer) => [
    {
      path: layer.id,
      label: layer.label,
      accepts: layer.accepts,
      block: layer.block,
    },
    ...slotPlaces(layer.id, layer.block),
  ]);
}

function withChild(
  block: StyleBlock,
  [name, ...rest]: string[],
  next: StyleBlock | null,
): StyleBlock {
  const current = block.slots?.[name] ?? null;
  const child =
    rest.length === 0 ? next : current && withChild(current, rest, next);
  return { ...block, slots: { ...block.slots, [name]: child } };
}

/** A copy of the template with the block at `path` replaced. The path must come from `listPlaces`. */
export function replaceAt(
  template: Template,
  path: string,
  next: StyleBlock | null,
): Template {
  const [layerId, ...rest] = path.split(".");
  return {
    ...template,
    layers: template.layers.map((layer) => {
      if (layer.id !== layerId) return layer;
      if (rest.length === 0) return { ...layer, block: next };
      return layer.block
        ? { ...layer, block: withChild(layer.block, rest, next) }
        : layer;
    }),
  };
}
