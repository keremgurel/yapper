import type { ContentSpecs } from "./format/content-spec";
import type { OptionSpecs } from "./format/option-spec";
import {
  STYLE_CATEGORIES,
  type StyleCategoryId,
} from "./format/style-category";
import type {
  AnyStyleDefinition,
  SlotSpec,
  StyleRule,
} from "./format/style-definition";
import { STYLES } from "./registry";

/**
 * The library as plain JSON: what the gallery lists, what a `list styles`
 * action or connector tool returns, and what the Mac app would read to draw
 * the same controls. No components, so it can cross any boundary.
 */
export interface CatalogEntry {
  id: string;
  version: number;
  name: string;
  category: StyleCategoryId;
  weight: AnyStyleDefinition["weight"];
  summary: string;
  output: AnyStyleDefinition["output"];
  layer: AnyStyleDefinition["layer"];
  options: OptionSpecs;
  content: ContentSpecs;
  slots: Record<string, SlotSpec>;
  rules: readonly StyleRule[];
  poster: string;
}

export interface CatalogShelf {
  id: StyleCategoryId;
  label: string;
  styles: CatalogEntry[];
}

/** Where the runner writes each entry's still, under the web app's public folder. */
export const posterPath = (styleId: string) => `/style-previews/${styleId}.jpg`;

export const catalogEntry = (style: AnyStyleDefinition): CatalogEntry => ({
  id: style.id,
  version: style.version,
  name: style.name,
  category: style.category,
  weight: style.weight,
  summary: style.summary,
  output: style.output,
  layer: style.layer,
  options: style.options,
  content: style.content,
  slots: style.slots ?? {},
  rules: style.rules,
  poster: posterPath(style.id),
});

/** Every shelf in gallery order. Shelves with nothing on them yet are left out. */
export function styleCatalog(
  styles: readonly AnyStyleDefinition[] = STYLES,
): CatalogShelf[] {
  return STYLE_CATEGORIES.map(({ id, label }) => ({
    id,
    label,
    styles: styles.filter((style) => style.category === id).map(catalogEntry),
  })).filter((shelf) => shelf.styles.length > 0);
}
