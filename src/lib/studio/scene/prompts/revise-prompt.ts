import type { BrandContext } from "../brand-context";
import type { RestyleInput, RetimeInput } from "../revise-input";
import {
  ART_DIRECTION,
  boxLines,
  DESIGN_ROLE,
  paletteLines,
} from "./design-prompt";
import {
  BRAND_TOKEN_GUIDE,
  DESIGN_OUTPUT_SHAPE,
  ICON_GUIDE,
  IMAGE_USAGE,
  READABILITY_RULES,
  SCENE_LANGUAGE_REFERENCE,
} from "./scene-language-reference";

/**
 * Restyling: the same designer, given the scene it made before and one
 * instruction about it. The rules here are about restraint: change what was
 * asked and keep the rest, so "more minimal" does not come back as a
 * different card.
 */
export const REVISE_SYSTEM = [
  DESIGN_ROLE,
  ART_DIRECTION,
  "",
  "You are revising a scene you designed earlier. You are given the scene as it is, the brief it was made from, and one instruction from the creator.",
  "",
  "REVISION RULES",
  "- Change what the instruction asks for and keep everything it does not mention: positions, colours, timings, text.",
  "- When asked to remove or replace an element, do exactly that to that element and nothing else.",
  "- Keep node ids the same for elements that survive, so the creator's idea of the card holds from one version to the next. New elements get new ids.",
  "- Update name and description only when what the card depicts has changed. A restyle of the same content keeps the same name.",
  "- The duration in the user message is the duration to design for; the scene's duration must equal it.",
  "- If the instruction asks for something the language cannot do, do the nearest thing it can and keep the rest intact.",
  "",
  SCENE_LANGUAGE_REFERENCE,
  "",
  BRAND_TOKEN_GUIDE,
  "",
  READABILITY_RULES,
  "",
  IMAGE_USAGE,
  "Pictures already in the scene are referenced as image:<key>. To keep one, keep its node and do not list it in images again; to replace one, ask for a new key.",
  "",
  ICON_GUIDE,
  "",
  DESIGN_OUTPUT_SHAPE,
].join("\n");

export function buildReviseUserMessage(
  input: RestyleInput,
  brand: BrandContext,
): string {
  const { asset } = input;
  return [
    asset.name ? `Current name: ${asset.name}` : "",
    asset.description ? `Current description: ${asset.description}` : "",
    asset.brief ? `Original brief: ${asset.brief}` : "",
    asset.quote ? `The words it plays over: "${asset.quote}"` : "",
    "",
    `Current scene:\n${JSON.stringify(asset.scene)}`,
    "",
    boxLines(input.box, input.duration, input),
    "",
    paletteLines(brand),
    "",
    `The creator says: ${input.instruction.trim()}`,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

/**
 * Retiming: "move it to where I say Berlin". A small pass that resolves the
 * new quote with the same rules the editorial pass uses, because the client
 * aligns it with the same code.
 */
export const RETIME_SYSTEM = [
  "You are the editor of a talking-head video. An overlay is being moved, and the creator has said in words where it should go. Find that place in the transcript.",
  "",
  "Return a QUOTE: the speaker's own words, copied verbatim from the transcript, marking where the overlay should be on screen. Rules for the quote:",
  "- Copy it EXACTLY as it appears in the transcript. Do not fix grammar, punctuation, or wording.",
  "- Between 3 and 20 words. It should start where the overlay should appear and end where it should leave.",
  '- Quote the stretch the creator is pointing at. When they name a word, the quote contains that word. When they say "the next sentence" or "near the conclusion", the previous quote below tells you where to count from.',
  "",
  "Add a CUE when the overlay belongs on one word: it must be one or two words copied from inside the quote. Leave it out when the overlay belongs over the whole quote.",
  "",
  'Reply with JSON only: {"quote":"exact words from the transcript","cue":"one word"}. If nothing in the transcript matches, reply {"quote":""}.',
].join("\n");

export function buildRetimeUserMessage(input: RetimeInput): string {
  const transcript = input.words.map((w) => w.text).join(" ");
  return (
    (input.quoteHint
      ? `The overlay currently plays over: "${input.quoteHint}"\n\n`
      : "") +
    `Transcript:\n${transcript}\n\n` +
    `The creator says: ${input.instruction.trim()}`
  );
}
