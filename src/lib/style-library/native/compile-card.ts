import type { StyleBlock } from "../format/style-block";
import { resolveOptions } from "../format/resolve-values";
import { splitOptions } from "../entries/split-speaker-below/options";
import { splitGeometry } from "../entries/split-speaker-below/split-geometry";
import { DESIGN_FRAME } from "../runtime/design-frame";
import type { CompiledLayout } from "./compile-layout";

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const fx = (px: number) => round(px / DESIGN_FRAME.width);
const fy = (px: number) => round(px / DESIGN_FRAME.height);

/**
 * The speaker-below split as a card layout: the take in a rounded card at the
 * bottom, placed by its headroom, with an optional pop-out, and a box above
 * for a visual shown whole as a card.
 */
export function compileCard(block: StyleBlock): CompiledLayout {
  const { values } = resolveOptions(splitOptions, block.options);
  const geometry = splitGeometry(values);
  const unsupported: string[] = [];
  if (values.edgeLine) {
    unsupported.push(
      "The thin line inside the speaker card is not in the editor yet.",
    );
  }
  const visual = block.slots?.visual;
  if (visual && visual.styleId !== "overlays.media") {
    unsupported.push(
      `The top holds ${visual.styleId}, which the editor cannot draw yet. It stays empty for a picture or clip.`,
    );
  }
  return {
    layout: {
      kind: "card",
      camera: {
        x: fx(geometry.speaker.left),
        y: fy(geometry.speaker.top),
        width: fx(geometry.speaker.width),
        height: fy(geometry.speaker.height),
      },
      cameraTop: fy(geometry.take.top),
      cornerRadius: fx(values.cornerRadius),
      popOut: values.popOut,
      visual: {
        x: fx(geometry.visual.left),
        y: fy(geometry.visual.top),
        width: fx(geometry.visual.width),
        height: fy(geometry.visual.height),
      },
    },
    backdropOptions: values,
    unsupported,
  };
}
