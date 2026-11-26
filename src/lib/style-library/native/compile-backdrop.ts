import type { NativeBackdrop } from "./native-plan";

export interface CompiledBackdrop {
  backdrop: NativeBackdrop | null;
  unsupported: string[];
}

/**
 * The shared backdrop options in the terms of `editor.project.setBackdrop`.
 * The dotted grid is the editor's Grid preset on the backdrop colour; a flat
 * colour is the project's colour. The blurred take and the creator's own image
 * or video have no backdrop of that kind in the editor yet.
 */
export function compileBackdrop(
  options: Record<string, unknown> | null,
): CompiledBackdrop {
  if (!options) return { backdrop: null, unsupported: [] };
  const color = String(options.backdropColor ?? "#0A0A0A").toUpperCase();
  switch (options.backdrop) {
    case "dots":
      return {
        backdrop: { preset: "shapeGrid", presetColors: [color] },
        unsupported: [],
      };
    case "color":
      return { backdrop: { color }, unsupported: [] };
    default:
      return {
        backdrop: { color },
        unsupported: [
          `The ${String(options.backdrop)} backdrop is a flat colour in the editor for now.`,
        ],
      };
  }
}
