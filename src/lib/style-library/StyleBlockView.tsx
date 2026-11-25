import type { ReactNode } from "react";
import { applyStyle } from "./apply-style";
import type { StyleBlock } from "./format/style-block";
import type { BlockPlacement } from "./format/style-definition";
import { materialFor, type ProjectMaterial } from "./project-material";
import { getStyle } from "./registry";

/** The content a block really has: empty text and missing media do not count. */
const filled = (content: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(content).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );

/**
 * Draws a block and, inside it, the blocks in its slots. This is the only
 * place a block becomes pixels, whoever wrote it: a person, Chirpy or a
 * connector.
 */
export function StyleBlockView({
  block,
  material,
  placement = "frame",
  defaults,
  samples = false,
}: {
  block: StyleBlock;
  material: ProjectMaterial;
  placement?: BlockPlacement;
  /** Options the surroundings suggest, for example a caption height from the layout. The block's own win. */
  defaults?: Record<string, unknown>;
  /** In a preview, show a block's sample content wherever it has none of its own yet. */
  samples?: boolean;
}) {
  const style = getStyle(block.styleId);
  if (!style) return null;
  // A sample is all or nothing: once a block has anything of its own, mixing in
  // sample values (a sample's red "cost" colour, say) would misdescribe it.
  const own = samples ? filled(block.content) : (block.content ?? {});
  const sample =
    samples && Object.keys(own).length === 0 ? style.preview.content : {};
  const result = applyStyle({
    styleId: style.id,
    options: { ...defaults, ...block.options },
    // Project material goes in before the block's own, so a block can pin its own.
    content: { ...sample, ...materialFor(style, material), ...own },
  });
  if (!result.ok) return null;

  const slots: Record<string, ReactNode> = {};
  for (const name of Object.keys(style.slots ?? {})) {
    const child = block.slots?.[name];
    if (child) {
      slots[name] = (
        <StyleBlockView
          block={child}
          material={material}
          placement="slot"
          samples={samples}
        />
      );
    }
  }

  return (
    <style.Component
      options={result.applied.options}
      content={result.applied.content}
      slots={slots}
      placement={placement}
    />
  );
}
