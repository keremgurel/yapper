import type { StyleBlock } from "../format/style-block";
import { resolveOptions } from "../format/resolve-values";
import { halfOptions } from "../entries/split-half-and-half/options";
import { DESIGN_FRAME } from "../runtime/design-frame";
import type { NativeLayout } from "./native-plan";

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export interface CompiledLayout {
  layout: NativeLayout;
  /** The backdrop options, for `compileBackdrop`. */
  backdropOptions: Record<string, unknown> | null;
  unsupported: string[];
}

/**
 * A template's layout block in the editor's terms. The full frame is the
 * editor's own default. The half-and-half split becomes a camera box below the
 * seam and a top box above it; the slot's media is the creator's, so only the
 * box is compiled.
 */
export function compileLayout(block: StyleBlock | null): CompiledLayout | null {
  if (!block || block.styleId === "layouts.full-frame") {
    const zoom = Number(block?.options?.zoom ?? 1);
    return {
      layout: { kind: "fullFrame" },
      backdropOptions: null,
      unsupported:
        zoom > 1
          ? ["The punch-in on a full frame is set per clip by hand."]
          : [],
    };
  }
  if (block.styleId !== "splits.half-and-half") return null;

  const { values } = resolveOptions(halfOptions, block.options);
  const seam = values.splitAt / DESIGN_FRAME.height;
  const insetX = values.visualInset / DESIGN_FRAME.width;
  const insetY = values.visualInset / DESIGN_FRAME.height;
  const unsupported: string[] = [];
  if (values.seamLine) {
    unsupported.push("The line on the seam is not in the editor yet.");
  }
  const top = block.slots?.top;
  if (top && top.styleId !== "overlays.media") {
    unsupported.push(
      `The top half holds ${top.styleId}, which the editor cannot draw yet. It stays empty for a picture or clip.`,
    );
  }
  return {
    layout: {
      kind: "split",
      camera: { x: 0, y: round(seam), width: 1, height: round(1 - seam) },
      cameraZoom: values.cameraZoom,
      cameraFocusY: values.cameraFocusY,
      top: {
        x: round(insetX),
        y: round(insetY),
        width: round(1 - insetX * 2),
        height: round(Math.max(0, seam - insetY * 2)),
      },
    },
    backdropOptions: values,
    unsupported,
  };
}
