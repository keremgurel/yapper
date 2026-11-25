import { resolveOptions } from "../format/resolve-values";
import { getStyle } from "../registry";
import type { Template } from "./template";

/** Where the template's layout wants captions, or `null` when it has no opinion. */
export function captionHeight(template: Template): number | null {
  for (const { block } of template.layers) {
    const style = block && getStyle(block.styleId);
    if (block && style?.captionY) {
      return style.captionY(
        resolveOptions(style.options, block.options).values,
      );
    }
  }
  return null;
}
