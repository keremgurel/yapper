import type { StyleBlock } from "../format/style-block";
import { resolveOptions } from "../format/resolve-values";
import { captionOptions } from "../entries/captions-plain-white/options";
import { DESIGN_FRAME } from "../runtime/design-frame";
import type { NativeCaptions } from "./native-plan";

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export interface CompiledCaptions {
  captions: NativeCaptions | null;
  unsupported: string[];
}

/**
 * The caption block as a caption style. The editor sizes text as point size
 * over frame height, the block in pixels on a 1080 x 1920 frame, so the two
 * convert one to one. `seamY` is where the layout wants captions; the block's
 * own height wins when someone set it.
 */
export function compileCaptions(
  block: StyleBlock | null,
  seamY: number | null,
): CompiledCaptions {
  if (!block) return { captions: null, unsupported: [] };
  if (block.styleId !== "captions.plain-white") {
    return {
      captions: null,
      unsupported: [`${block.styleId} captions are not in the editor yet.`],
    };
  }
  const sent = block.options ?? {};
  const { values } = resolveOptions(captionOptions, {
    ...(seamY !== null && sent.y === undefined ? { y: seamY } : {}),
    ...sent,
  });
  const unsupported =
    values.weight === "800"
      ? []
      : [
          "The editor's caption font has one weight, so the weight is not carried over.",
        ];
  return {
    captions: {
      style: {
        x: 0.5,
        y: round(values.y / DESIGN_FRAME.height),
        width: round(1 - (values.sideMargin * 2) / DESIGN_FRAME.width),
        fontScale: round(values.fontSize / DESIGN_FRAME.height),
        font: "modern",
        color: values.color.toUpperCase(),
        strokeEnabled: false,
        backgroundEnabled: false,
        shadowEnabled: values.shadow,
      },
      wordsPerCard: values.maxWords,
    },
    unsupported,
  };
}
