import type {
  BooleanOption,
  ColorOption,
  EnumChoice,
  EnumOption,
  MediaOption,
  NumberOption,
  TextOption,
} from "./option-spec";

/** Builders that keep literal types, so a style's values are typed from its specs. */

export const numberOption = (
  spec: Omit<NumberOption, "kind">,
): NumberOption => ({
  kind: "number",
  ...spec,
});

export const enumOption = <const V extends string>(
  spec: Omit<EnumOption<V>, "kind" | "choices"> & {
    choices: readonly EnumChoice<V>[];
  },
): EnumOption<V> => ({ kind: "enum", ...spec });

export const colorOption = (spec: Omit<ColorOption, "kind">): ColorOption => ({
  kind: "color",
  ...spec,
});

export const booleanOption = (
  spec: Omit<BooleanOption, "kind">,
): BooleanOption => ({ kind: "boolean", ...spec });

export const textOption = (spec: Omit<TextOption, "kind">): TextOption => ({
  kind: "text",
  ...spec,
});

export const mediaOption = (
  spec: Omit<MediaOption, "kind" | "default"> & { default?: string | null },
): MediaOption => ({ kind: "media", default: null, ...spec });
