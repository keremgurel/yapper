import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { StyleFont } from "../../src/lib/style-library/format/style-definition";

/** Fonts the runner knows how to fetch. A style asking for another family fails loudly. */
const LOADERS: Record<string, typeof loadInter> = { Inter: loadInter };

/** Loads every font the given styles declare, before the first frame is drawn. */
export function loadStyleFonts(fonts: readonly StyleFont[]): void {
  for (const font of fonts) {
    const load = LOADERS[font.family];
    if (!load)
      throw new Error(
        `The runner has no loader for the font '${font.family}'.`,
      );
    load(font.italic ? "italic" : "normal", {
      weights: font.weights.map(String) as Parameters<
        typeof loadInter
      >[1] extends { weights?: infer W } | undefined
        ? W
        : never,
      subsets: ["latin"],
    });
  }
}
