import type { OptionValues } from "../../format/option-spec";
import { DESIGN_FRAME } from "../../runtime/design-frame";
import type { SplitOptionSpecs } from "./options";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SplitGeometry {
  /** The speaker card, clipped at the bottom edge of the frame. */
  speaker: Box;
  /** The whole take inside the card, scaled with its aspect kept. */
  take: Box;
  /** The box the top visual is centred in. */
  visual: Box;
}

type GeometryOptions = Pick<
  OptionValues<SplitOptionSpecs>,
  | "speakerScale"
  | "speakerTop"
  | "speakerHeadroom"
  | "visualTop"
  | "visualInset"
  | "seamGap"
>;

/** Where everything sits on the design frame for a set of options. */
export function splitGeometry(options: GeometryOptions): SplitGeometry {
  const { width: frameW, height: frameH } = DESIGN_FRAME;
  const width = frameW * options.speakerScale;
  const top = options.speakerTop;
  return {
    speaker: { left: (frameW - width) / 2, top, width, height: frameH - top },
    take: {
      left: 0,
      top: -options.speakerHeadroom * options.speakerScale,
      width,
      height: frameH * options.speakerScale,
    },
    visual: {
      left: options.visualInset,
      top: options.visualTop,
      width: frameW - options.visualInset * 2,
      height: Math.max(0, top - options.seamGap - options.visualTop),
    },
  };
}
