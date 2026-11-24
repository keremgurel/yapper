import type { ScenePalette } from "../studio/scene/scene-colors";
import type { ContentSpecs, ContentValues } from "./format/content-spec";
import type { OptionSpecs, OptionValues } from "./format/option-spec";
import { resolveContent, resolveOptions } from "./format/resolve-values";
import type { AnyStyleDefinition } from "./format/style-definition";
import type { StyleRequest } from "./format/style-variant";
import { getStyle, STYLES } from "./registry";

/** A style ready to draw: the entry, complete values, and what was changed on the way. */
export interface AppliedStyle {
  style: AnyStyleDefinition;
  options: OptionValues<OptionSpecs>;
  content: ContentValues<ContentSpecs>;
  notes: string[];
}

export type ApplyResult =
  | { ok: true; applied: AppliedStyle }
  | { ok: false; reason: "unknown_style"; known: string[] };

/**
 * Applies a style by name, the way Chirpy, a connector or the gallery asks for
 * one. Bad values never fail the request: they fall back and come back as
 * notes the caller can show or feed to the model.
 */
export function applyStyle(
  request: StyleRequest,
  palette?: ScenePalette,
): ApplyResult {
  const style = getStyle(request.styleId);
  if (!style) {
    return {
      ok: false,
      reason: "unknown_style",
      known: STYLES.map((s) => s.id),
    };
  }
  const options = resolveOptions(style.options, request.options, palette);
  const content = resolveContent(style.content, request.content);
  return {
    ok: true,
    applied: {
      style,
      options: options.values,
      content: content.values,
      notes: [...options.notes, ...content.notes],
    },
  };
}
