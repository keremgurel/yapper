import type { BrandContext } from "../brand-context";
import type { DesignMoment } from "../design-input";
import {
  BRAND_TOKEN_GUIDE,
  DESIGN_OUTPUT_SHAPE,
  ICON_GUIDE,
  IMAGE_USAGE,
  minLegibleTextSize,
  READABILITY_RULES,
  SCENE_LANGUAGE_REFERENCE,
} from "./scene-language-reference";

/**
 * The designer. One call per moment; it gets the brief, the box the layout
 * solver found, the brand tokens, and the language, and answers with a scene.
 */
export const DESIGN_ROLE =
  "You are a motion designer for short talking-head videos. You compose each visual in a small declarative scene language; the app renders it, you never touch a renderer. You are given a brief from the video's editor, the box on screen the visual will occupy, and the creator's brand tokens. Design for that box: sizes are fractions of it.";

/** Craft criteria, not example scenes or a catalogue of allowed compositions. */
export const ART_DIRECTION = [
  "ART DIRECTION — this is a finished editorial motion graphic, not a UI wireframe.",
  "Start with one visual idea that makes the brief tangible. Pick a focal element and establish a decisive hierarchy: dominant information, supporting context, generous intentional empty space. A small box is not a reason to shrink a dashboard into it.",
  "Choose a coherent visual language for this subject. Do not default to rounded cards, pill labels, fake browser chrome, emoji-like icons or a grid of equal-weight boxes. A background panel must earn its area through contrast or composition; transparent negative space is valid. Use a restrained palette with one purposeful accent, deliberate alignment, and consistent strokes/radii.",
  "Show relationships spatially or through change rather than stacking sentences. Never draw a chart with invented intermediate data. Never invent messages, testimonials, interface screenshots or quoted speech to make the visual look specific. Do not manufacture evidence.",
  "For a before-to-now change, animate from the stated BEFORE value to the stated NOW value, not from zero. The starting value is part of the meaning, not an entrance effect. Keep units and categories unambiguous; do not imply an unknown baseline or invent a growth rate.",
  "A conceptual contrast (how paid reach stops when spending stops while organic reach keeps compounding, for instance) is drawn as a schematic, and a schematic must read as one: no axis numbers, no tick values, no dated points, no legend that implies a dataset, and a qualitative label such as 'how it behaves' rather than 'our traffic'. Curves and steps may be smooth and generic. A chart with numbers on it is a claim about measured data, and the speaker did not make that claim.",
  "Choreograph setup → meaningful change → readable resolution. Motion must communicate the idea, not just make the whole card bounce. Lead with the focal element; secondary details follow, and any ambient movement stays subordinate. Use restrained eased entrances and quicker exits. Give the final state time to be read; do not keep everything moving or loop decoration over the speaker.",
  "Judge the composition at its ACTUAL small size over a moving video. Remove details that become visual noise. Strong typography and one well-executed relationship are better than a miniature collection of widgets. Do not fill spare space merely because it exists.",
].join("\n");

export const DESIGN_SYSTEM = [
  DESIGN_ROLE,
  ART_DIRECTION,
  "",
  SCENE_LANGUAGE_REFERENCE,
  "",
  BRAND_TOKEN_GUIDE,
  "",
  READABILITY_RULES,
  "",
  IMAGE_USAGE,
  "",
  ICON_GUIDE,
  "",
  DESIGN_OUTPUT_SHAPE,
  "The scene's duration must equal the duration in the user message. Keep every node inside the box.",
  "Return compact JSON, with no prose or whitespace formatting. Omit optional default-valued fields. Use the fewest nodes/animation segments that express your concept clearly; repeated decorative detail should not consume the output budget.",
].join("\n");

export interface DesignContext {
  brand: BrandContext;
  instruction: string;
  frameAspect: number;
  frameHeightPx: number;
}

export function paletteLines(brand: BrandContext): string {
  const p = brand.palette;
  return (
    `Brand palette (what the tokens resolve to): primary ${p.primary}, secondary ${p.secondary}, accent ${p.accent}, ink ${p.ink}, surface ${p.surface}, muted ${p.muted}.` +
    (brand.hasKit
      ? ""
      : " This is the neutral house palette; the creator has no brand kit.") +
    "\n" +
    (brand.logos.length > 0
      ? "A logo is available as asset brand.logo. Use it only if the brief calls for the brand itself."
      : "No logo is available: do not reference brand.logo.")
  );
}

export function boxLines(
  box: DesignMoment["box"],
  duration: number,
  context: Pick<DesignContext, "frameAspect" | "frameHeightPx">,
): string {
  const minSize = minLegibleTextSize(context.frameHeightPx, box.heightPx);
  return [
    `Box: ${box.aspect.toFixed(2)} wide per tall, ${Math.round(box.widthPx)} by ${Math.round(box.heightPx)} pixels at export.`,
    `Frame: ${context.frameAspect.toFixed(3)} wide per tall, ${Math.round(context.frameHeightPx)} pixels tall.`,
    `Minimum text size: ${(Math.ceil(minSize * 1000) / 1000).toFixed(3)} (fraction of the SCENE box height, even inside groups). Smaller text fails quality checks; it is NEVER automatically enlarged.`,
    `Every text/number node needs explicit height, enough width for its longest value, and room for line height. Measure mentally: a bold character averages 0.6 × font size pixels. Simplify wording or sequence content in time if it cannot fit.`,
    `LAYOUT ARITHMETIC: single-line height >= size × 1.3. Width >= character count × size × 0.65 / ${box.aspect.toFixed(3)}. A node starting at y must leave its full text height before the next row. Keep y + height <= 0.94. Calculate these before answering. Font size is NOT a fraction of the text node height.`,
    `Only ${Math.floor(0.8 / (minSize * 1.3))} minimum-size lines fit vertically in this box, and a hero number uses more than one of those lines. Do not cram a dashboard into this space. Preserve the main fact; let narration carry secondary detail if it cannot fit.`,
    `Duration: ${duration.toFixed(3)} seconds. The scene's duration must be exactly this.`,
  ].join("\n");
}

export function buildDesignUserMessage(
  moment: DesignMoment,
  context: DesignContext,
): string {
  return [
    `Brief: ${moment.brief}`,
    moment.name ? `Proposed name: ${moment.name}` : "",
    moment.description ? `Proposed description: ${moment.description}` : "",
    `Kind: ${moment.kind}${moment.wantsImage ? " (the editor expects a generated picture)" : ""}`,
    `The words it plays over: "${moment.quote}"`,
    moment.sentence !== moment.quote
      ? `The sentence they sit in: "${moment.sentence}"`
      : "",
    moment.wordTimings?.length
      ? "SPEECH TIMING (seconds from the overlay's start):\n" +
        moment.wordTimings
          .map((w) => `${w.at.toFixed(3)}–${w.end.toFixed(3)} ${w.text}`)
          .join("\n") +
        "\nSynchronize meaningful changes with these spoken cues. Hold the earlier state while it is described; start the transition on 'now' or the corresponding change in meaning. Do not reveal the result before the speaker introduces it. These cues take priority over generic entrance/settle percentages."
      : "",
    "",
    boxLines(moment.box, moment.duration, context),
    "",
    paletteLines(context.brand),
    "",
    context.instruction.trim()
      ? `The creator's original instruction: ${context.instruction.trim()}`
      : "",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}
