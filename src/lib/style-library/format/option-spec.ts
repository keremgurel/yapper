/**
 * One switchable setting of a style. Specs are plain data, so the same list
 * drives the gallery controls, Chirpy's `apply` input, a connector tool and a
 * saved variant without a second description of the style.
 *
 * Lengths are pixels on the 1080 x 1920 design frame (see `design-frame.ts`).
 */

/** Hides a control until another enum option has one of these values. */
export interface OptionCondition {
  option: string;
  in: readonly string[];
}

interface OptionBase {
  label: string;
  help?: string;
  showWhen?: OptionCondition;
}

export type NumberUnit = "px" | "ratio" | "seconds" | "frames" | "words";

export interface NumberOption extends OptionBase {
  kind: "number";
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: NumberUnit;
}

export interface EnumChoice<V extends string = string> {
  value: V;
  label: string;
}

export interface EnumOption<V extends string = string> extends OptionBase {
  kind: "enum";
  default: V;
  choices: readonly EnumChoice<V>[];
}

/** A hex colour or a brand token (`brand.primary`), as in the scene format. */
export interface ColorOption extends OptionBase {
  kind: "color";
  default: string;
}

export interface BooleanOption extends OptionBase {
  kind: "boolean";
  default: boolean;
}

export interface TextOption extends OptionBase {
  kind: "text";
  default: string;
  maxLength: number;
}

export type MediaKind = "image" | "video";

/** A picture or clip by URL. `null` means nothing picked. */
export interface MediaOption extends OptionBase {
  kind: "media";
  default: string | null;
  accepts: readonly MediaKind[];
}

export type OptionSpec =
  | NumberOption
  | EnumOption
  | ColorOption
  | BooleanOption
  | TextOption
  | MediaOption;

export type OptionSpecs = Record<string, OptionSpec>;

export type OptionValue<S> = S extends NumberOption
  ? number
  : S extends EnumOption<infer V>
    ? V
    : S extends BooleanOption
      ? boolean
      : S extends MediaOption
        ? string | null
        : S extends ColorOption | TextOption
          ? string
          : never;

export type OptionValues<S extends OptionSpecs> = {
  [K in keyof S]: OptionValue<S[K]>;
};
