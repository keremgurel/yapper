/**
 * Names come from the model and are checked, not trusted. A generated overlay
 * lives in the media library beside the creator's own files and gets referred
 * to by `@` mention, so "Overlay 1" is useless and "Customer growth counter,
 * 1,200 to 2,850" is the standard (docs/ai-overlays-plan.md, "The media
 * library entry").
 */

export const OVERLAY_NAME_MIN = 8;
export const OVERLAY_NAME_MAX = 60;
export const OVERLAY_DESCRIPTION_MAX = 140;

const GENERIC = new Set([
  "overlay",
  "animation",
  "graphic",
  "visual",
  "untitled",
  "scene",
  "card",
  "image",
  "picture",
  "motion graphic",
]);

/** Words a brief tends to open with that say nothing about the visual. */
const BRIEF_LEAD_INS =
  /^(?:show(?:ing)?|display(?:ing)?|create|make|draw|an?|the|animated?|animation of|a visual of)\s+/i;
const CLAUSE_BREAK =
  /,|;|:|\s+(?:that|which|with|showing|where|while|as|so)\s+|\.\s|\.$/;

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const strip = (text: string) =>
  collapse(text)
    .replace(/^["'“”‘’`\s]+|["'“”‘’`\s]+$/g, "")
    .replace(/[\s.,;:!?\-–]+$/g, "");

function wordCount(text: string): number {
  return text.split(" ").filter(Boolean).length;
}

function cutToLength(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return strip(space > max / 2 ? cut.slice(0, space) : cut.slice(0, max));
}

function isGeneric(name: string): boolean {
  const lower = name.toLowerCase();
  if (GENERIC.has(lower)) return true;
  if (
    /^(?:overlay|animation|graphic|visual|scene|card|image)\s*#?\d+$/.test(
      lower,
    )
  ) {
    return true;
  }
  return wordCount(name) < 2 && !/\d/.test(name);
}

function acceptable(name: string): boolean {
  return (
    name.length >= OVERLAY_NAME_MIN &&
    name.length <= OVERLAY_NAME_MAX &&
    !isGeneric(name)
  );
}

function firstWords(text: string, count: number): string {
  return collapse(text).split(" ").filter(Boolean).slice(0, count).join(" ");
}

/** The first noun phrase of a brief, roughly: its opening clause with the lead-in gone. */
function nameFromBrief(brief: string): string {
  const opening = collapse(brief).replace(BRIEF_LEAD_INS, "");
  const clause = opening.split(CLAUSE_BREAK)[0] ?? "";
  const phrase = strip(firstWords(clause, 7));
  return phrase ? phrase[0].toUpperCase() + phrase.slice(1) : "";
}

function nameFromQuote(quote: string): string {
  const words = firstWords(strip(quote), 5);
  return words ? `Visual for "${words}"` : "";
}

/**
 * The model's proposed name, cleaned, or a name built from the brief or the
 * quote when the proposal is generic, too short, or missing.
 */
export function cleanOverlayName(
  name: unknown,
  fallback: { brief?: string; quote?: string },
): string {
  const proposed =
    typeof name === "string" ? cutToLength(strip(name), OVERLAY_NAME_MAX) : "";
  if (acceptable(proposed)) return proposed;
  const fromBrief = cutToLength(
    nameFromBrief(fallback.brief ?? ""),
    OVERLAY_NAME_MAX,
  );
  if (acceptable(fromBrief)) return fromBrief;
  const fromQuote = cutToLength(
    nameFromQuote(fallback.quote ?? ""),
    OVERLAY_NAME_MAX,
  );
  if (acceptable(fromQuote)) return fromQuote;
  return "Generated overlay card";
}

/** One sentence about what it looks like, or an empty string. */
export function cleanOverlayDescription(text: unknown): string {
  if (typeof text !== "string") return "";
  const collapsed = collapse(text);
  if (!collapsed) return "";
  const sentence = collapsed.split(/(?<=[.!?])\s+/)[0] ?? collapsed;
  const trimmed = cutToLength(strip(sentence), OVERLAY_DESCRIPTION_MAX - 1);
  return trimmed ? `${trimmed}.` : "";
}

/**
 * The name, or the name with the quote's first words appended when the
 * library already has one like it, or a counter when even that collides.
 */
export function uniqueOverlayName(
  name: string,
  taken: readonly string[],
  quote?: string,
): string {
  const used = new Set(taken.map((t) => collapse(t).toLowerCase()));
  const free = (candidate: string) => !used.has(candidate.toLowerCase());
  if (free(name)) return name;
  const words = firstWords(strip(quote ?? ""), 3);
  if (words) {
    const suffix = `, "${words}"`;
    const withQuote =
      cutToLength(name, OVERLAY_NAME_MAX - suffix.length) + suffix;
    if (free(withQuote)) return withQuote;
  }
  for (let n = 2; n < 100; n++) {
    const suffix = ` ${n}`;
    const candidate =
      cutToLength(name, OVERLAY_NAME_MAX - suffix.length) + suffix;
    if (free(candidate)) return candidate;
  }
  return name;
}
