/**
 * How the compiled brain is introduced to the model.
 *
 * Three headers rather than one, because the three parts are three different
 * kinds of claim and the model has to treat them differently. The core is
 * ground truth. The index is a catalogue of things it has not read and must not
 * pretend to have read. The loaded part is the material for this task.
 *
 * That middle instruction is load-bearing. Without it a model shown a line
 * saying "Keyword research, 240 rows" will happily cite rows it never saw.
 */

const CORE_HEADER =
  "THE CREATOR'S STANDING CONTEXT. Treat it as ground truth about who they " +
  "are and who they are talking to. Write for this audience in this voice; " +
  "never restate it back to them.";

const INDEX_HEADER =
  "ALSO IN THEIR BRAIN, listed but NOT loaded here. You have not read these. " +
  "Never quote or invent their contents. You may say that one of them looks " +
  "relevant, by name, when it genuinely is.";

const LOADED_HEADER =
  "LOADED FOR THIS TASK. Follow any skill below as written, and treat any " +
  "section below as the creator's own material to work from.";

export interface BrainSectionParts {
  core: string;
  index: string;
  loaded: string;
}

/**
 * Wrap the parts for appending to a system prompt. Empty in, empty out, so a
 * creator who has filled nothing in gets the behaviour they had before this
 * system existed rather than a prompt asserting context that is not there.
 *
 * Appended rather than prepended, and in this order, deliberately. The fixed
 * instructions come first so that prefix is identical for every creator and
 * caches across all of them. Core and index are byte-stable for one creator, so
 * they cache across their repeated calls. Only the loaded tail varies per
 * request, which puts the one part that cannot cache last, where it costs the
 * least.
 */
export function brainSection(parts: BrainSectionParts): string {
  const sections: string[] = [];
  if (parts.core.trim()) sections.push(`${CORE_HEADER}\n\n${parts.core}`);
  if (parts.index.trim()) sections.push(`${INDEX_HEADER}\n\n${parts.index}`);
  if (parts.loaded.trim()) sections.push(`${LOADED_HEADER}\n\n${parts.loaded}`);
  if (!sections.length) return "";
  return `\n\n${sections.join("\n\n")}`;
}
