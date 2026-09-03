import { SCENE_BRAND_TOKENS } from "../scene-colors";
import { curatedIconList } from "../scene-icons";
import { SCENE_LIMITS } from "../scene-limits";
import {
  SCENE_ANCHORS,
  SCENE_EASINGS,
  SCENE_FONTS,
  SCENE_NUMBER_FORMATS,
  SCENE_PROPERTIES,
  SCENE_WEIGHTS,
} from "../scene-types";

/**
 * The parts of the designer prompt that describe the scene language itself.
 * Written once here and shared by the design and revise prompts, derived from
 * docs/overlay-scene-format.md so the words the model reads and the rules the
 * validator applies come from the same constants.
 */

const list = (values: readonly string[]) => values.join(", ");

export const SCENE_LANGUAGE_REFERENCE = [
  "SCENE LANGUAGE",
  "",
  "A scene is JSON: { version: 1, duration, poster, background?, nodes, animations }.",
  "- duration is seconds. It must equal the duration you are given; the app holds the last frame if the overlay runs longer.",
  "- poster is the time of the most informative frame, used for the library still. Default 60% of the duration.",
  "- background is optional: { fill, cornerRadius, opacity }. Without one the nodes sit straight over the video.",
  "",
  "Units. Every coordinate is a fraction of the overlay's own box, not the video frame. x and width are fractions of the box width, y and height are fractions of the box height, measured from the top left. Every other size (font size, stroke width, corner radius) is a fraction of the box height, so the design keeps its weight in a wider or narrower box. Times are seconds from the overlay's own start.",
  "",
  "Nodes. Common fields: id (unique, letters digits _ -), type, x, y, width, height, opacity (default 1), rotate (degrees), anchor (where scale and rotate pivot: " +
    list(SCENE_ANCHORS) +
    "; default center).",
  "- text: text, font (" +
    list(SCENE_FONTS) +
    "), weight (" +
    list(SCENE_WEIGHTS) +
    "), size, color, align (left, center, right), lineHeight (multiple, default 1.15), uppercase. Give explicit height sufficient for all lines; text must fit without overlapping other text.",
  "- number: everything text takes except text, plus from, to, format (" +
    list(SCENE_NUMBER_FORMATS) +
    "), prefix, suffix. It draws the value at the animated `value` progress between from and to, so a counter is a number node with a value animation from 0 to 1.",
  "- rect: fill, stroke, strokeWidth, cornerRadius.",
  "- ellipse: fill, stroke, strokeWidth.",
  "- line: x2, y2 (the end point, same units as x and y), stroke, strokeWidth, dashed.",
  "- path: d (SVG path data in a unit square, 0 to 1 on both axes, mapped onto the node's box), fill, stroke, strokeWidth. Use it for arrows, curves, sparklines and outlines.",
  "- icon: icon (a Lucide icon name), color, strokeWidth (default 0.02).",
  "- image: asset (brand.logo, or image:<key> for a picture you asked for), fit (contain, cover), cornerRadius.",
  "- group: children, positioned inside the group's box in fractions of that box. Font and stroke sizes inside a group are still fractions of the scene box height.",
  "",
  "Animations: { node, property, from?, to, start, end, easing?, stagger? }.",
  "- node is a node id, or * for every top level node.",
  "- property is one of " + list(SCENE_PROPERTIES) + ".",
  "- from defaults to the node's own value. Before start the property holds from; after end it holds to. Several animations on the same property of one node run in start order and each takes over from the previous one's to.",
  "- easing is one of " + list(SCENE_EASINGS) + "; default outCubic.",
  "- stagger (seconds) offsets the animation for each successive child when node is a group or *.",
  "- value animates a number node's count. strokeEnd draws a path, line, rect, ellipse or icon on from 0 to 1. scaleX and scaleY grow from the anchor, so a bar that rises from its base has anchor bottom.",
  "",
  "Colours are #RRGGBB, #RRGGBBAA, or a brand token: " +
    list(SCENE_BRAND_TOKENS) +
    ". Prefer tokens: they follow the creator's brand kit.",
  "",
  "Limits, enforced after you answer: at most " +
    `${SCENE_LIMITS.maxNodes} nodes counting children, ${SCENE_LIMITS.maxAnimations} animations counting staggered copies, ${SCENE_LIMITS.maxTextLength} characters of text per node, ${SCENE_LIMITS.maxPathBytes / 1024} KB of path data per node, ${SCENE_LIMITS.maxImages} images per scene, groups ${SCENE_LIMITS.maxGroupDepth} deep. ` +
    "Positions between -0.5 and 1.5, sizes between 0 and 1.5. Unknown fields are ignored; unknown node types and properties are dropped.",
].join("\n");

export const BRAND_TOKEN_GUIDE = [
  "BRAND TOKENS",
  "- brand.primary for the one element that carries the point: the big number, the taller bar, the highlighted step.",
  "- brand.ink on brand.surface for text on a card. brand.surface is the card; brand.ink reads on it whatever the brand is.",
  "- brand.muted for secondary labels, axes, baselines and the element being compared against.",
  "- brand.secondary and brand.accent for a second series or a small flourish, never for body text.",
  "- A scene without a background sits straight on the footage; then give text a rect behind it or use a bold weight, because you do not know what the shot looks like.",
].join("\n");

export const READABILITY_RULES = [
  "READABILITY",
  "- The largest text carries the point. Everything else is smaller and quieter.",
  "- Never go below the minimum text size you are given. It is the smallest size that reads at playback speed on a phone, expressed as a fraction of your box height.",
  "- No more than about 12 words on a card. It is glanced at while someone is talking.",
  "- Keep 6% padding inside the box on every side: nothing closer than x 0.06 or wider than 0.88, nothing above y 0.06 or below 0.94.",
  "- Entrance in the first 0.3 seconds, the main motion settles by about 40% of the duration, then hold. No exit unless the duration is over 4 seconds, and then a short fade in the last 0.3 seconds.",
  "- One idea per card. If the brief holds two, show the bigger one and let the words carry the rest.",
  "- Text is not a decorative texture. Avoid stacked labels beside tiny numbers. Prefer a short label, a truly dominant value and generous whitespace. Sequence related facts rather than squeezing everything into one frame.",
  "- A number with different from/to needs an explicit value animation from 0 to 1. Animated requests must contain real motion, not merely static before/after labels. Hold the starting value briefly, animate, then hold the final value long enough to read.",
  "- Never animate text width or height: animate position, opacity or scale. Give text its final layout dimensions from the start.",
].join("\n");

export const COMPOSITION_GUIDE = [
  "COMPOSITION BY KIND",
  "- counter: the number dominant (size 0.3 or more), a short label above or below, and one supporting element that moves with it: a bar growing with scaleX from anchor left, or an arrow drawn on.",
  "- chart: rects with scaleY from anchor bottom for bars, staggered; a baseline line; the values as text above each bar and the categories below. A line chart is a path with strokeEnd from 0 to 1.",
  "- comparison: two columns, before on the left in brand.muted and after on the right in brand.primary, each with its value and label, and an arrow or delta between them.",
  "- list: one row per item, each an icon plus text in a group, entering with a stagger of 0.25 to 0.4 seconds so the rows land as they are spoken.",
  "- diagram: icons with text under them, joined by arrow paths drawn on with strokeEnd in sequence, entering with a stagger so the flow reads left to right.",
  "- typography: one phrase, set large, with weight contrast between the key words and the rest. Nothing else on the card.",
  "- map or illustration: an image node you asked for, filling most of the box, with labels or markers in text and ellipse nodes animated over it.",
].join("\n");

export const IMAGE_USAGE = [
  "PICTURES",
  "Only ask for a picture when shapes and text cannot carry the subject: a map, a photographic subject, an illustration of a place or an object. To use one, return it in images as { key, prompt, aspect } (at most " +
    `${SCENE_LIMITS.maxImages}` +
    ") and reference it from an image node as asset \"image:<key>\". Write the prompt for an image model: describe the picture, its style and its palette in words; no text in the picture, no logos, no people's faces. aspect is width over height and should match the node's box. brand.logo may be used as an asset only when the user message says a logo is available.",
].join("\n");

export const ICON_GUIDE =
  "ICONS\nA short list of Lucide icons that render well at card size: " +
  curatedIconList() +
  ". Any Lucide icon name works; an icon that does not exist is dropped.";

export const DESIGN_OUTPUT_SHAPE =
  'Reply with JSON only, in exactly this shape: { "name": "what the visual is, 8 to 60 characters, concrete", "description": "one sentence about what it looks like", "scene": { "version": 1, "duration": 4.2, "poster": 1.8, "background": {}, "nodes": [], "animations": [] }, "images": [] }.';

/** The smallest text size a box can carry, as a fraction of its own height. */
export function minLegibleTextSize(
  frameHeightPx: number,
  boxHeightPx: number,
): number {
  return (SCENE_LIMITS.minLegibleFrameFraction * frameHeightPx) / boxHeightPx;
}
