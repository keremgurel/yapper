import type { AnyStyleDefinition } from "./style-definition";

/**
 * Someone's saved version of a style: the base entry plus only the values
 * they changed. Storing the difference means a later improvement to the base
 * reaches every variant that did not touch that option.
 *
 * Shaped after `project_skills`: a catalog row copied per project, with the
 * base version kept so "update available" can be shown.
 */
export interface StyleVariant {
  id: string;
  name: string;
  baseStyleId: string;
  baseVersion: number;
  /** Only the options that differ from the base. */
  options: Record<string, unknown>;
  /** Content the owner wants every time, for example a series title. */
  content: Record<string, unknown>;
}

/** What to apply: a library entry or a saved variant, with one-off changes on top. */
export interface StyleRequest {
  styleId: string;
  options?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

/** A variant as a request against its base, with the caller's changes winning. */
export function variantRequest(
  variant: StyleVariant,
  overrides: Pick<StyleRequest, "options" | "content"> = {},
): StyleRequest {
  return {
    styleId: variant.baseStyleId,
    options: { ...variant.options, ...overrides.options },
    content: { ...variant.content, ...overrides.content },
  };
}

/** True when the base has moved on since the variant was saved. */
export const variantIsBehind = (
  variant: StyleVariant,
  base: AnyStyleDefinition,
): boolean => variant.baseVersion < base.version;

/** Keeps only the values that differ from the base's defaults, ready to save. */
export function changedOptions(
  base: AnyStyleDefinition,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        key in base.options && base.options[key].default !== value,
    ),
  );
}
