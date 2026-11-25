import type { StyleBlock } from "../format/style-block";
import type { StyleCategoryId } from "../format/style-category";

/** One layer of a template: a named place that takes a block from certain shelves. */
export interface TemplateLayer {
  id: string;
  label: string;
  accepts: readonly StyleCategoryId[];
  block: StyleBlock | null;
}

/**
 * An arrangement of blocks: a layout, what sits in it, the captions over it.
 * Plain JSON. A template is a starting point, and every part of it can be
 * changed or swapped by naming the place.
 */
export interface Template {
  id: string;
  name: string;
  summary: string;
  /** Drawn bottom to top. */
  layers: TemplateLayer[];
}
