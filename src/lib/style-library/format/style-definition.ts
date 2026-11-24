import type { ComponentType, ReactNode } from "react";
import type { ContentSpecs, ContentValues } from "./content-spec";
import type { OptionSpecs, OptionValues } from "./option-spec";
import type { StyleBlock } from "./style-block";
import type { StyleCategoryId, StyleWeight } from "./style-category";

/** A taste decision, and the correction or measurement behind it. */
export interface StyleRule {
  rule: string;
  why?: string;
}

/** A font the style draws with. The host loads it before the first frame. */
export interface StyleFont {
  family: string;
  weights: readonly number[];
  italic?: boolean;
}

/** An open area of a style that another block fills, for example the top of a split. */
export interface SlotSpec {
  label: string;
  /** The shelves a block may come from to go in here. */
  accepts: readonly StyleCategoryId[];
}

/** `frame` when the block draws on the whole picture, `slot` when it sits inside another block's area. */
export type BlockPlacement = "frame" | "slot";

export interface StyleProps<
  O extends OptionSpecs = OptionSpecs,
  C extends ContentSpecs = ContentSpecs,
> {
  options: OptionValues<O>;
  content: ContentValues<C>;
  /** The drawn contents of each of this style's slots, by slot name. Empty slots are absent. */
  slots: Record<string, ReactNode>;
  placement: BlockPlacement;
}

/** The sample render shown in the gallery and used as the still for the entry. */
export interface StylePreview<O extends OptionSpecs, C extends ContentSpecs> {
  durationS: number;
  /** The most informative moment, used for the still. */
  posterS: number;
  /** Options changed for the sample only, to show the block the way it is most used. */
  options?: Partial<OptionValues<O>>;
  content: Partial<ContentValues<C>>;
  /** Sample blocks for the style's slots. */
  slots?: Record<string, StyleBlock>;
}

/**
 * One entry of the library: a component, the options that may be switched on
 * it, the content it is filled with, and the rules that explain its defaults.
 */
export interface StyleDefinition<
  O extends OptionSpecs = OptionSpecs,
  C extends ContentSpecs = ContentSpecs,
> {
  /** `<category>.<name>`, stable for ever: saved variants and actions point at it. */
  id: string;
  /** Raised when an option is removed or changes meaning, so variants can migrate. */
  version: number;
  name: string;
  category: StyleCategoryId;
  weight: StyleWeight;
  summary: string;
  output: "video" | "still";
  /**
   * `frame` draws the whole picture, the take included. `overlay` is
   * transparent and sits over the take, so a host with its own compositor can
   * render it with alpha and lay it on top.
   */
  layer: "frame" | "overlay";
  fonts: readonly StyleFont[];
  options: O;
  content: C;
  /** Open areas other blocks can fill. */
  slots?: Record<string, SlotSpec>;
  /**
   * For a layout: where captions belong while it is on screen, as the middle
   * of their first line. Captions take this place unless someone moved them.
   */
  captionY?: (options: OptionValues<O>) => number;
  rules: readonly StyleRule[];
  preview: StylePreview<O, C>;
  Component: ComponentType<StyleProps<O, C>>;
}

/** Checks a definition against its own specs while keeping the literal types. */
export const defineStyle = <O extends OptionSpecs, C extends ContentSpecs>(
  definition: StyleDefinition<O, C>,
): StyleDefinition<O, C> => definition;

/** A definition with its option and content types erased, as the registry holds it. */
export type AnyStyleDefinition = StyleDefinition<OptionSpecs, ContentSpecs>;

/** The registry's view of a definition. One cast, kept here. */
export const eraseStyle = <O extends OptionSpecs, C extends ContentSpecs>(
  definition: StyleDefinition<O, C>,
): AnyStyleDefinition => definition as unknown as AnyStyleDefinition;
